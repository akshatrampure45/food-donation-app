from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ApprovalStatus, DonorProfile, DonorType, OtpChannel, RecipientProfile, User, UserRole,
)
from app.security import create_token, get_current_user, hash_password, verify_password
from app.serializers import user_out
from app.services.otp import check_otp, issue_otp
from app.utils import normalize_phone, save_image

router = APIRouter(prefix="/api/auth", tags=["auth"])

BUSINESS_TYPES = {DonorType.restaurant, DonorType.hotel, DonorType.hostel, DonorType.canteen}


def _check_password(pw: str):
    if len(pw) < 8 or len(pw) > 64:
        raise HTTPException(422, "Password must be 8 to 64 characters")


def _ensure_free(db: Session, email: str, phone: str):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "This email is already registered. Please log in")
    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(409, "This phone number is already registered. Please log in")


def _send_both(db: Session, user: User) -> dict:
    p = issue_otp(db, user, OtpChannel.phone)
    e = issue_otp(db, user, OtpChannel.email)
    return {"phone": p, "email": e} if p or e else None


@router.post("/signup/donor")
def signup_donor(
    name: str = Form(...), email: EmailStr = Form(...), phone: str = Form(...), password: str = Form(...),
    donor_type: DonorType = Form(...), business_name: str = Form(""), registration_number: str = Form(""),
    event_details: str = Form(""), address: str = Form(""),
    latitude: float | None = Form(None), longitude: float | None = Form(None),
    selfie: UploadFile = File(...), db: Session = Depends(get_db),
):
    email = email.lower()
    phone = normalize_phone(phone)
    _check_password(password)
    _ensure_free(db, email, phone)
    if donor_type in BUSINESS_TYPES:
        if not registration_number.strip():
            raise HTTPException(422, "Registration / FSSAI / licence number is required for hotels, restaurants, hostels and canteens")
        if not business_name.strip():
            raise HTTPException(422, "Business name is required")
    if donor_type == DonorType.event and not event_details.strip():
        raise HTTPException(422, "Please add event details (event name, date, organiser)")
    if latitude is None or longitude is None:
        raise HTTPException(422, "Please set your location")

    selfie_url = save_image(db, selfie, label="Live selfie")
    user = User(role=UserRole.donor, name=name.strip(), email=email, phone=phone,
                password_hash=hash_password(password), selfie_url=selfie_url)
    db.add(user)
    db.flush()
    db.add(DonorProfile(
        user_id=user.id, donor_type=donor_type, business_name=business_name.strip() or None,
        registration_number=registration_number.strip() or None, event_details=event_details.strip() or None,
        address=address.strip() or None, latitude=latitude, longitude=longitude,
    ))
    dev = _send_both(db, user)
    db.commit()
    return {"message": "Account created. Verify your phone and email.", "email": email, "dev_otps": dev}


@router.post("/signup/recipient")
def signup_recipient(
    org_name: str = Form(...), contact_person: str = Form(...), email: EmailStr = Form(...),
    phone: str = Form(...), password: str = Form(...), registration_number: str = Form(...),
    address: str = Form(""), latitude: float | None = Form(None), longitude: float | None = Form(None),
    org_photo: UploadFile = File(...), db: Session = Depends(get_db),
):
    email = email.lower()
    phone = normalize_phone(phone)
    _check_password(password)
    _ensure_free(db, email, phone)
    if not registration_number.strip():
        raise HTTPException(422, "Organisation registration number is required")
    if latitude is None or longitude is None:
        raise HTTPException(422, "Please set your organisation's location")

    photo_url = save_image(db, org_photo, label="Organisation photo")
    user = User(role=UserRole.recipient, name=contact_person.strip(), email=email, phone=phone,
                password_hash=hash_password(password))
    db.add(user)
    db.flush()
    db.add(RecipientProfile(
        user_id=user.id, org_name=org_name.strip(), contact_person=contact_person.strip(),
        registration_number=registration_number.strip(), org_photo_url=photo_url,
        address=address.strip() or None, latitude=latitude, longitude=longitude,
        approval_status=ApprovalStatus.pending,
    ))
    dev = _send_both(db, user)
    db.commit()
    return {"message": "Account created. Verify your phone and email.", "email": email, "dev_otps": dev}


class OtpIn(BaseModel):
    email: EmailStr
    channel: OtpChannel
    code: str


class ResendIn(BaseModel):
    email: EmailStr
    channel: OtpChannel


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/verify-otp")
def verify_otp(data: OtpIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user:
        raise HTTPException(404, "Account not found")
    check_otp(db, user, data.channel, data.code)
    return {"phone_verified": user.phone_verified, "email_verified": user.email_verified}


@router.post("/resend-otp")
def resend_otp(data: ResendIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user:
        raise HTTPException(404, "Account not found")
    already = user.phone_verified if data.channel == OtpChannel.phone else user.email_verified
    if already:
        raise HTTPException(400, "Already verified")
    code = issue_otp(db, user, data.channel)
    db.commit()
    return {"message": "OTP sent", "dev_otp": code}


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    if not user.is_active:
        raise HTTPException(403, "This account is disabled")
    if not (user.phone_verified and user.email_verified):
        return JSONResponse(status_code=403, content={
            "detail": "Please verify your phone and email first", "code": "NOT_VERIFIED",
            "phone_verified": user.phone_verified, "email_verified": user.email_verified,
        })
    return {"token": create_token(user), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)
