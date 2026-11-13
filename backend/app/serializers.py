from app.models import (
    DonationRequest, DonorProfile, FoodListing, ListingStatus, RecipientProfile, RequestStatus, User,
)
from app.utils import iso, utcnow


def user_out(u: User) -> dict:
    out = {
        "id": u.id, "role": u.role.value, "name": u.name, "email": u.email, "phone": u.phone,
        "selfie": u.selfie_url, "phone_verified": u.phone_verified, "email_verified": u.email_verified,
        "donor_profile": None, "recipient_profile": None,
    }
    if u.donor_profile:
        d = u.donor_profile
        out["donor_profile"] = {
            "id": d.id, "donor_type": d.donor_type.value, "business_name": d.business_name,
            "registration_number": d.registration_number, "event_details": d.event_details,
            "address": d.address, "latitude": d.latitude, "longitude": d.longitude,
        }
    if u.recipient_profile:
        r = u.recipient_profile
        out["recipient_profile"] = {
            "id": r.id, "org_name": r.org_name, "contact_person": r.contact_person,
            "registration_number": r.registration_number, "org_photo": r.org_photo_url,
            "address": r.address, "latitude": r.latitude, "longitude": r.longitude,
            "approval_status": r.approval_status.value,
        }
    return out


def donor_public(d: DonorProfile) -> dict:
    return {
        "id": d.id, "name": d.business_name or d.user.name, "donor_type": d.donor_type.value,
        "address": d.address, "latitude": d.latitude, "longitude": d.longitude,
    }


def recipient_public(r: RecipientProfile) -> dict:
    return {
        "id": r.id, "org_name": r.org_name, "address": r.address,
        "latitude": r.latitude, "longitude": r.longitude, "photo": r.org_photo_url,
    }


def listing_out(l: FoodListing) -> dict:
    status = l.status.value
    if l.status == ListingStatus.available and l.expires_at <= utcnow():
        status = "expired"
    return {
        "id": l.id, "food_name": l.food_name, "description": l.description,
        "quantity_kg": l.quantity_kg, "servings": l.servings, "is_veg": l.is_veg,
        "photo": l.food_photo_url, "cooked_at": iso(l.cooked_at), "expires_at": iso(l.expires_at),
        "pickup_address": l.pickup_address, "latitude": l.latitude, "longitude": l.longitude,
        "status": status, "created_at": iso(l.created_at), "donor": donor_public(l.donor),
    }


def request_out(req: DonationRequest, me: User) -> dict:
    l = req.listing
    rp = req.recipient
    dp = l.donor
    reveal = req.status in (RequestStatus.negotiating, RequestStatus.approved, RequestStatus.completed)
    my_role = me.role.value
    return {
        "id": req.id, "status": req.status.value, "my_role": my_role,
        "initiated_by_me": req.initiated_by_user_id == me.id,
        "initiated_by_role": "donor" if req.initiated_by_user_id == dp.user_id else "recipient",
        "listing": listing_out(l),
        "recipient": recipient_public(rp),
        "donor_contact": {"name": dp.user.name, "phone": dp.user.phone, "email": dp.user.email} if reveal else None,
        "recipient_contact": {"name": rp.contact_person, "phone": rp.user.phone, "email": rp.user.email} if reveal else None,
        "meeting_location": req.meeting_location, "meeting_time": iso(req.meeting_time),
        "donor_approved": req.donor_approved, "recipient_approved": req.recipient_approved,
        "note": req.note, "created_at": iso(req.created_at), "completed_at": iso(req.completed_at),
    }
