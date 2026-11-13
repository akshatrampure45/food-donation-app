import base64
import io
import secrets

import qrcode
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ApprovalStatus, DonationQR, DonationRequest, FoodListing, ListingStatus, Message, RecipientProfile,
    RequestStatus, User, UserRole,
)
from app.security import get_current_user, require_role
from app.serializers import request_out
from app.services.notify import notify
from app.services.otp import send_email
from app.utils import iso, parse_dt, utcnow

router = APIRouter(prefix="/api/requests", tags=["requests"])

ACTIVE = [RequestStatus.pending, RequestStatus.negotiating, RequestStatus.approved]


# ---------- helpers ----------
def _load(db: Session, request_id: int, user: User) -> DonationRequest:
    req = db.get(DonationRequest, request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    donor_user_id = req.listing.donor.user_id
    recipient_user_id = req.recipient.user_id
    if user.id not in (donor_user_id, recipient_user_id):
        raise HTTPException(404, "Request not found")
    return req


def _other_user(req: DonationRequest, me: User) -> User:
    return req.recipient.user if me.role == UserRole.donor else req.listing.donor.user


def _link(req) -> str:
    return f"/requests/{req.id}"


# ---------- create ----------
class CreateIn(BaseModel):
    listing_id: int
    recipient_id: int | None = None  # needed when a donor offers food
    note: str | None = None


@router.post("")
def create_request(data: CreateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = db.get(FoodListing, data.listing_id)
    if not listing or listing.status != ListingStatus.available or listing.expires_at <= utcnow():
        raise HTTPException(400, "This food is no longer available")

    if user.role == UserRole.recipient:
        rp = user.recipient_profile
        if rp.approval_status != ApprovalStatus.approved:
            raise HTTPException(403, "Your organisation is not approved yet")
    elif user.role == UserRole.donor:
        if listing.donor_id != user.donor_profile.id:
            raise HTTPException(403, "This is not your listing")
        if not data.recipient_id:
            raise HTTPException(422, "Choose an organisation")
        rp = db.get(RecipientProfile, data.recipient_id)
        if not rp or rp.approval_status != ApprovalStatus.approved:
            raise HTTPException(404, "Organisation not found")
    else:
        raise HTTPException(403, "Not allowed")

    existing = db.query(DonationRequest).filter(
        DonationRequest.listing_id == listing.id, DonationRequest.recipient_id == rp.id,
        DonationRequest.status.in_(ACTIVE),
    ).first()
    if existing:
        raise HTTPException(409, "A request already exists for this food")

    req = DonationRequest(
        listing_id=listing.id, recipient_id=rp.id, initiated_by_user_id=user.id,
        status=RequestStatus.pending, note=(data.note or "").strip()[:500] or None,
    )
    db.add(req)
    db.flush()
    if user.role == UserRole.recipient:
        notify(db, listing.donor.user_id, "New food request",
               f"{rp.org_name} wants \"{listing.food_name}\".", _link(req))
    else:
        notify(db, rp.user_id, "Food offered to you",
               f"{listing.donor.business_name or listing.donor.user.name} is offering \"{listing.food_name}\".", _link(req))
    db.commit()
    db.refresh(req)
    return request_out(req, user)


@router.get("")
def my_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == UserRole.donor:
        rows = (
            db.query(DonationRequest).join(FoodListing, DonationRequest.listing_id == FoodListing.id)
            .filter(FoodListing.donor_id == user.donor_profile.id).order_by(DonationRequest.id.desc()).all()
        )
    elif user.role == UserRole.recipient:
        rows = (
            db.query(DonationRequest).filter(DonationRequest.recipient_id == user.recipient_profile.id)
            .order_by(DonationRequest.id.desc()).all()
        )
    else:
        rows = []
    return [request_out(r, user) for r in rows]


@router.get("/{request_id}")
def get_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return request_out(_load(db, request_id, user), user)


# ---------- accept / decline ----------
@router.post("/{request_id}/accept")
def accept(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status != RequestStatus.pending:
        raise HTTPException(400, "This request is not waiting for a reply")
    if req.initiated_by_user_id == user.id:
        raise HTTPException(403, "The other side has to accept this request")
    if req.listing.status != ListingStatus.available or req.listing.expires_at <= utcnow():
        raise HTTPException(400, "This food is no longer available")
    req.status = RequestStatus.negotiating
    notify(db, req.initiated_by_user_id, "Request accepted",
           "You can now chat, see contact details and agree on a pickup place.", _link(req))
    db.commit()
    return request_out(req, user)


@router.post("/{request_id}/decline")
def decline(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status not in ACTIVE:
        raise HTTPException(400, "This request is already closed")
    was_approved = req.status == RequestStatus.approved
    req.status = RequestStatus.cancelled
    if req.qr:
        db.delete(req.qr)
    if was_approved and req.listing.status == ListingStatus.reserved and req.listing.expires_at > utcnow():
        req.listing.status = ListingStatus.available
    notify(db, _other_user(req, user).id, "Request cancelled",
           f"The request for \"{req.listing.food_name}\" was cancelled.", _link(req))
    db.commit()
    return request_out(req, user)


# ---------- agree on location, both approve ----------
class ProposeIn(BaseModel):
    meeting_location: str
    meeting_time: str


@router.post("/{request_id}/propose")
def propose(request_id: int, data: ProposeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status != RequestStatus.negotiating:
        raise HTTPException(400, "Accept the request first (or it is already finalised)")
    loc = data.meeting_location.strip()
    if len(loc) < 3:
        raise HTTPException(422, "Enter the pickup/meeting location")
    when = parse_dt(data.meeting_time)
    if when <= utcnow():
        raise HTTPException(422, "Meeting time must be in the future")
    if when > req.listing.expires_at:
        raise HTTPException(422, "Meeting time is after the food expiry time")
    req.meeting_location = loc[:500]
    req.meeting_time = when
    req.donor_approved = user.role == UserRole.donor
    req.recipient_approved = user.role == UserRole.recipient
    notify(db, _other_user(req, user).id, "New pickup proposal", f"{loc}", _link(req))
    db.commit()
    return request_out(req, user)


@router.post("/{request_id}/approve")
def approve(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status != RequestStatus.negotiating:
        raise HTTPException(400, "Nothing to approve right now")
    if not req.meeting_location or not req.meeting_time:
        raise HTTPException(400, "Propose a pickup location and time first")
    if req.listing.expires_at <= utcnow():
        raise HTTPException(400, "This food has expired")
    if user.role == UserRole.donor:
        req.donor_approved = True
    else:
        req.recipient_approved = True

    if req.donor_approved and req.recipient_approved:
        req.status = RequestStatus.approved
        req.listing.status = ListingStatus.reserved
        db.add(DonationQR(request_id=req.id, token=secrets.token_urlsafe(32)))
        others = db.query(DonationRequest).filter(
            DonationRequest.listing_id == req.listing_id, DonationRequest.id != req.id,
            DonationRequest.status.in_([RequestStatus.pending, RequestStatus.negotiating]),
        ).all()
        for o in others:
            o.status = RequestStatus.cancelled
            notify(db, o.recipient.user_id, "Food no longer available",
                   f"\"{req.listing.food_name}\" was given to another organisation.", _link(o))
        notify(db, req.listing.donor.user_id, "Pickup confirmed",
               "Show your QR code to the recipient at pickup.", _link(req))
        notify(db, req.recipient.user_id, "Pickup confirmed",
               "Scan the donor's QR code at pickup to complete the donation.", _link(req))
    else:
        notify(db, _other_user(req, user).id, "Waiting for your approval",
               f"The other side approved the pickup at {req.meeting_location}.", _link(req))
    db.commit()
    return request_out(req, user)


# ---------- chat ----------
class MessageIn(BaseModel):
    body: str


@router.get("/{request_id}/messages")
def get_messages(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    rows = db.query(Message).filter(Message.request_id == req.id).order_by(Message.id).all()
    return [{"id": m.id, "mine": m.sender_id == user.id, "body": m.body, "created_at": iso(m.created_at)} for m in rows]


@router.post("/{request_id}/messages")
def send_message(request_id: int, data: MessageIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status not in ACTIVE:
        raise HTTPException(400, "Chat is closed for this request")
    body = data.body.strip()
    if not body:
        raise HTTPException(422, "Message is empty")
    db.add(Message(request_id=req.id, sender_id=user.id, body=body[:1000], created_at=utcnow()))
    other = _other_user(req, user)
    notify(db, other.id, "New message", body[:120], _link(req))
    db.commit()
    return {"ok": True}


# ---------- QR ----------
@router.get("/{request_id}/qr")
def get_qr(request_id: int, user: User = Depends(require_role(UserRole.donor)), db: Session = Depends(get_db)):
    req = _load(db, request_id, user)
    if req.status != RequestStatus.approved or not req.qr:
        raise HTTPException(400, "QR is available only after both sides approve")
    img = qrcode.make("FDP:" + req.qr.token, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return {"qr_png_base64": base64.b64encode(buf.getvalue()).decode(), "is_used": req.qr.is_used}


class ScanIn(BaseModel):
    token: str


@router.post("/scan")
def scan_qr(data: ScanIn, background: BackgroundTasks, user: User = Depends(require_role(UserRole.recipient)),
            db: Session = Depends(get_db)):
    qr = db.query(DonationQR).filter(DonationQR.token == data.token.strip()).first()
    if not qr:
        raise HTTPException(404, "Invalid QR code")
    req = qr.request
    if req.recipient_id != user.recipient_profile.id:
        raise HTTPException(403, "This QR code is not meant for your organisation")
    if qr.is_used or req.status == RequestStatus.completed:
        raise HTTPException(409, "This QR code has already been used")
    if req.status != RequestStatus.approved:
        raise HTTPException(400, "This donation is not active")
    if req.listing.expires_at <= utcnow():
        raise HTTPException(400, "This food has expired and cannot be collected")

    now = utcnow()
    # atomic one-time use: only one scan can flip is_used from False to True
    changed = db.query(DonationQR).filter(DonationQR.id == qr.id, DonationQR.is_used == False).update(  # noqa: E712
        {"is_used": True, "used_at": now, "scanned_by_user_id": user.id}, synchronize_session=False)
    if changed == 0:
        db.rollback()
        raise HTTPException(409, "This QR code has already been used")
    req.status = RequestStatus.completed
    req.completed_at = now
    req.listing.status = ListingStatus.donated
    donor_user = req.listing.donor.user
    name = req.listing.food_name
    notify(db, donor_user.id, "Donation completed 🎉",
           f"{req.recipient.org_name} received \"{name}\". Thank you for helping!", _link(req))
    notify(db, user.id, "Donation received", f"You collected \"{name}\".", _link(req))
    db.commit()

    background.add_task(send_email, donor_user.email, "Donation completed",
                        f"<p>Thank you! <b>{req.recipient.org_name}</b> received your donation of <b>{name}</b>.</p>")
    background.add_task(send_email, user.email, "Donation received",
                        f"<p>You successfully collected <b>{name}</b> from {req.listing.donor.business_name or req.listing.donor.user.name}.</p>")
    return {"ok": True, "request": request_out(req, user)}
