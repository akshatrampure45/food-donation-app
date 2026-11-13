from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ApprovalStatus, DonationRequest, DonorProfile, FoodListing, Image, ListingStatus, Notification,
    RecipientProfile, RequestStatus, User, UserRole,
)
from app.security import get_current_user, require_role
from app.serializers import user_out
from app.services.notify import notify
from app.utils import iso

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/images/{image_id}")
def get_image(image_id: str, db: Session = Depends(get_db)):
    img = db.get(Image, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    return Response(content=img.data, media_type=img.mime, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    donated = db.query(FoodListing).filter(FoodListing.status == ListingStatus.donated)
    kg = db.query(func.coalesce(func.sum(FoodListing.quantity_kg), 0)).filter(FoodListing.status == ListingStatus.donated).scalar()
    servings = db.query(func.coalesce(func.sum(FoodListing.servings), 0)).filter(FoodListing.status == ListingStatus.donated).scalar()
    return {
        "donations": donated.count(), "kg_saved": round(float(kg or 0), 1), "servings": int(servings or 0),
        "donors": db.query(User).filter(User.role == UserRole.donor, User.phone_verified == True, User.email_verified == True).count(),  # noqa: E712
        "organisations": db.query(RecipientProfile).filter(RecipientProfile.approval_status == ApprovalStatus.approved).count(),
    }


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    rows = (
        db.query(DonorProfile, func.count(FoodListing.id), func.coalesce(func.sum(FoodListing.quantity_kg), 0))
        .join(FoodListing, FoodListing.donor_id == DonorProfile.id)
        .filter(FoodListing.status == ListingStatus.donated)
        .group_by(DonorProfile.id).order_by(func.count(FoodListing.id).desc()).limit(20).all()
    )
    return [
        {"name": d.business_name or d.user.name, "donor_type": d.donor_type.value, "donations": c, "kg": round(float(kg), 1)}
        for d, c, kg in rows
    ]


@router.get("/me/impact")
def my_impact(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == UserRole.donor:
        q = db.query(FoodListing).filter(FoodListing.donor_id == user.donor_profile.id, FoodListing.status == ListingStatus.donated)
        rows = q.all()
    elif user.role == UserRole.recipient:
        rows = [r.listing for r in db.query(DonationRequest).filter(
            DonationRequest.recipient_id == user.recipient_profile.id, DonationRequest.status == RequestStatus.completed)]
    else:
        rows = []
    return {
        "donations": len(rows),
        "kg": round(sum(l.quantity_kg or 0 for l in rows), 1),
        "servings": sum(l.servings or 0 for l in rows),
    }


# ---------- notifications ----------
@router.get("/notifications")
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(40).all()
    unread = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).count()  # noqa: E712
    return {
        "unread": unread,
        "items": [{"id": n.id, "title": n.title, "body": n.body, "link": n.link, "is_read": n.is_read,
                   "created_at": iso(n.created_at)} for n in rows],
    }


@router.post("/notifications/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).update(  # noqa: E712
        {"is_read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


# ---------- admin ----------
@router.get("/admin/recipients")
def admin_recipients(status: ApprovalStatus = ApprovalStatus.pending,
                     user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    rows = db.query(RecipientProfile).filter(RecipientProfile.approval_status == status).order_by(RecipientProfile.id.desc()).all()
    return [user_out(r.user) for r in rows]


@router.post("/admin/recipients/{profile_id}/{action}")
def admin_decide(profile_id: int, action: str, user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    if action not in ("approve", "reject"):
        raise HTTPException(404, "Unknown action")
    rp = db.get(RecipientProfile, profile_id)
    if not rp:
        raise HTTPException(404, "Organisation not found")
    rp.approval_status = ApprovalStatus.approved if action == "approve" else ApprovalStatus.rejected
    if action == "approve":
        notify(db, rp.user_id, "Organisation approved 🎉", "You can now find nearby food donors.", "/recipient")
    else:
        notify(db, rp.user_id, "Organisation not approved", "Please contact support to fix your details.", "/recipient")
    db.commit()
    return {"ok": True, "approval_status": rp.approval_status.value}
