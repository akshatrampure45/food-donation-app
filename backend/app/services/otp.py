import hashlib
import hmac
import secrets
from datetime import timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import OtpCode, OtpChannel, User
from app.utils import utcnow

RESEND_COOLDOWN_SECONDS = 30
MAX_ATTEMPTS = 5


def _hash(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def send_sms(phone: str, code: str) -> bool:
    """MSG91 Send OTP API. Needs MSG91_AUTH_KEY and an approved MSG91_TEMPLATE_ID."""
    if not (settings.MSG91_AUTH_KEY and settings.MSG91_TEMPLATE_ID):
        print(f"[DEV] SMS OTP for {phone}: {code}")
        return False
    try:
        r = httpx.post(
            "https://control.msg91.com/api/v5/otp",
            params={
                "template_id": settings.MSG91_TEMPLATE_ID,
                "mobile": phone,
                "authkey": settings.MSG91_AUTH_KEY,
                "otp": code,
            },
            headers={"Content-Type": "application/json"},
            json={},
            timeout=15,
        )
        if r.status_code >= 400:
            print("MSG91 error:", r.status_code, r.text)
            return False
        return True
    except Exception as e:
        print("MSG91 exception:", e)
        return False


def send_email(to: str, subject: str, html: str) -> bool:
    """Brevo transactional email API."""
    if not (settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL):
        print(f"[DEV] Email to {to} | {subject}")
        return False
    try:
        r = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json", "content-type": "application/json"},
            json={
                "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html,
            },
            timeout=15,
        )
        if r.status_code >= 400:
            print("Brevo error:", r.status_code, r.text)
            return False
        return True
    except Exception as e:
        print("Brevo exception:", e)
        return False


def issue_otp(db: Session, user: User, channel: OtpChannel) -> str | None:
    """Create + send an OTP. Returns the code only in DEV_MODE."""
    target = user.phone if channel == OtpChannel.phone else user.email
    now = utcnow()
    last = (
        db.query(OtpCode)
        .filter(OtpCode.user_id == user.id, OtpCode.channel == channel)
        .order_by(OtpCode.id.desc())
        .first()
    )
    if last and (now - last.created_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
        raise HTTPException(429, f"Please wait {RESEND_COOLDOWN_SECONDS} seconds before asking for a new OTP")

    code = f"{secrets.randbelow(10**6):06d}"
    db.add(OtpCode(
        user_id=user.id, channel=channel, target=target, code_hash=_hash(code),
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MIN), created_at=now,
    ))
    db.flush()

    if channel == OtpChannel.phone:
        send_sms(target, code)
    else:
        send_email(
            target, "Your verification code",
            f"<p>Hi {user.name},</p><p>Your Food Donation Platform verification code is "
            f"<b style='font-size:20px'>{code}</b>.</p><p>It expires in {settings.OTP_EXPIRE_MIN} minutes.</p>",
        )
    return code if settings.DEV_MODE else None


def check_otp(db: Session, user: User, channel: OtpChannel, code: str) -> bool:
    otp = (
        db.query(OtpCode)
        .filter(OtpCode.user_id == user.id, OtpCode.channel == channel, OtpCode.used == False)  # noqa: E712
        .order_by(OtpCode.id.desc())
        .first()
    )
    if not otp:
        raise HTTPException(400, "No OTP found. Please request a new one")
    if otp.expires_at < utcnow():
        raise HTTPException(400, "OTP expired. Please request a new one")
    if otp.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong attempts. Please request a new OTP")
    if not hmac.compare_digest(otp.code_hash, _hash(code.strip())):
        otp.attempts += 1
        db.commit()
        raise HTTPException(400, "Wrong OTP")
    otp.used = True
    if channel == OtpChannel.phone:
        user.phone_verified = True
    else:
        user.email_verified = True
    db.commit()
    return True
