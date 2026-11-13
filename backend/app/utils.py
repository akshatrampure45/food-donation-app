import math
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models import Image

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def parse_dt(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(422, "Invalid date/time")
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "91" + digits
    if len(digits) < 11 or len(digits) > 15:
        raise HTTPException(422, "Enter a valid phone number")
    return digits


def haversine(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bbox(lat: float, lng: float, radius_km: float):
    dlat = radius_km / 111.0
    dlng = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def save_image(db: Session, file: UploadFile | None, required: bool = True, label: str = "Photo") -> str | None:
    if file is None or not file.filename:
        if required:
            raise HTTPException(422, f"{label} is required")
        return None
    data = file.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(422, f"{label} is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, f"{label} is too large (max 5 MB)")
    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(422, f"{label} must be an image")
    img = Image(id=uuid.uuid4().hex, mime=mime, data=data)
    db.add(img)
    db.flush()
    return f"/api/images/{img.id}"
