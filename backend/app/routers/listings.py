from datetime import timedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ApprovalStatus, DonationRequest, FoodListing, ListingStatus, RecipientProfile, RequestStatus, User, UserRole,
)
from app.security import get_current_user, require_role
from app.serializers import listing_out, recipient_public
from app.services.notify import notify
from app.utils import bbox, haversine, parse_dt, save_image, utcnow

router = APIRouter(prefix="/api", tags=["listings"])


@router.post("/listings")
def create_listing(
    food_name: str = Form(...), description: str = Form(""), quantity_kg: float | None = Form(None),
    servings: int | None = Form(None), is_veg: bool = Form(True),
    cooked_at: str = Form(...), expires_at: str = Form(...), pickup_address: str = Form(""),
    latitude: float | None = Form(None), longitude: float | None = Form(None),
    food_photo: UploadFile = File(...),
    user: User = Depends(require_role(UserRole.donor)), db: Session = Depends(get_db),
):
    dp = user.donor_profile
    cooked, expires, now = parse_dt(cooked_at), parse_dt(expires_at), utcnow()
    if not food_name.strip():
        raise HTTPException(422, "Food name is required")
    if not quantity_kg and not servings:
        raise HTTPException(422, "Enter the quantity (kg) or number of servings")
    if cooked > now.replace(microsecond=0) + timedelta(minutes=10):
        raise HTTPException(422, "Cooking time cannot be in the future")
    if expires <= now:
        raise HTTPException(422, "Expiry time must be in the future")
    if expires <= cooked:
        raise HTTPException(422, "Expiry time must be after cooking time")
    lat = latitude if latitude is not None else dp.latitude
    lng = longitude if longitude is not None else dp.longitude
    if lat is None or lng is None:
        raise HTTPException(422, "Pickup location is required")

    photo = save_image(db, food_photo, label="Live food photo")
    listing = FoodListing(
        donor_id=dp.id, food_name=food_name.strip(), description=description.strip() or None,
        quantity_kg=quantity_kg, servings=servings, is_veg=is_veg, food_photo_url=photo,
        cooked_at=cooked, expires_at=expires, pickup_address=pickup_address.strip() or dp.address,
        latitude=lat, longitude=lng, status=ListingStatus.available,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing_out(listing)


@router.get("/listings/mine")
def my_listings(user: User = Depends(require_role(UserRole.donor)), db: Session = Depends(get_db)):
    rows = (
        db.query(FoodListing).filter(FoodListing.donor_id == user.donor_profile.id)
        .order_by(FoodListing.id.desc()).all()
    )
    return [listing_out(l) for l in rows]


@router.post("/listings/{listing_id}/cancel")
def cancel_listing(listing_id: int, user: User = Depends(require_role(UserRole.donor)), db: Session = Depends(get_db)):
    l = db.get(FoodListing, listing_id)
    if not l or l.donor_id != user.donor_profile.id:
        raise HTTPException(404, "Listing not found")
    if l.status in (ListingStatus.donated, ListingStatus.cancelled):
        raise HTTPException(400, f"This listing is already {l.status.value}")
    l.status = ListingStatus.cancelled
    active = db.query(DonationRequest).filter(
        DonationRequest.listing_id == l.id,
        DonationRequest.status.in_([RequestStatus.pending, RequestStatus.negotiating, RequestStatus.approved]),
    ).all()
    for r in active:
        r.status = RequestStatus.cancelled
        if r.qr:
            db.delete(r.qr)
        notify(db, r.recipient.user_id, "Food listing cancelled",
               f"The donor cancelled \"{l.food_name}\".", f"/requests/{r.id}")
    db.commit()
    return {"ok": True}


def _approved_recipient(user: User) -> None:
    rp = user.recipient_profile
    if not rp or rp.approval_status != ApprovalStatus.approved:
        raise HTTPException(403, "Your organisation is not approved yet")


@router.get("/listings/nearby")
def nearby_listings(
    lat: float, lng: float, radius_km: float = Query(25, gt=0, le=200),
    user: User = Depends(require_role(UserRole.recipient)), db: Session = Depends(get_db),
):
    _approved_recipient(user)
    min_lat, max_lat, min_lng, max_lng = bbox(lat, lng, radius_km)
    now = utcnow()
    rows = db.query(FoodListing).filter(
        FoodListing.status == ListingStatus.available, FoodListing.expires_at > now,
        FoodListing.latitude.between(min_lat, max_lat), FoodListing.longitude.between(min_lng, max_lng),
    ).all()
    my_reqs = {
        r.listing_id: r for r in db.query(DonationRequest).filter(
            DonationRequest.recipient_id == user.recipient_profile.id,
            DonationRequest.status != RequestStatus.cancelled)
    }
    out = []
    for l in rows:
        d = haversine(lat, lng, l.latitude, l.longitude)
        if d > radius_km:
            continue
        item = listing_out(l)
        item["distance_km"] = round(d, 1)
        item["my_request_id"] = my_reqs[l.id].id if l.id in my_reqs else None
        out.append(item)
    out.sort(key=lambda x: x["distance_km"])
    return out


@router.get("/recipients/nearby")
def nearby_recipients(
    lat: float, lng: float, radius_km: float = Query(25, gt=0, le=200),
    user: User = Depends(require_role(UserRole.donor)), db: Session = Depends(get_db),
):
    min_lat, max_lat, min_lng, max_lng = bbox(lat, lng, radius_km)
    rows = db.query(RecipientProfile).filter(
        RecipientProfile.approval_status == ApprovalStatus.approved,
        RecipientProfile.latitude.between(min_lat, max_lat), RecipientProfile.longitude.between(min_lng, max_lng),
    ).all()
    out = []
    for r in rows:
        d = haversine(lat, lng, r.latitude, r.longitude)
        if d <= radius_km:
            item = recipient_public(r)
            item["distance_km"] = round(d, 1)
            out.append(item)
    out.sort(key=lambda x: x["distance_km"])
    return out
