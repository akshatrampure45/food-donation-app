import enum
from datetime import datetime

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum, LargeBinary, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    donor = "donor"
    recipient = "recipient"
    admin = "admin"


class DonorType(str, enum.Enum):
    individual = "individual"
    restaurant = "restaurant"
    hotel = "hotel"
    hostel = "hostel"
    canteen = "canteen"
    event = "event"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ListingStatus(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    donated = "donated"
    cancelled = "cancelled"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    negotiating = "negotiating"
    approved = "approved"
    completed = "completed"
    cancelled = "cancelled"


class OtpChannel(str, enum.Enum):
    phone = "phone"
    email = "email"


class Image(Base):
    """Photos (selfies, food, org) are stored in the DB so nothing is lost on Render redeploys."""
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # random, unguessable
    mime: Mapped[str] = mapped_column(String(50), default="image/jpeg")
    data: Mapped[bytes] = mapped_column(LargeBinary(16777215))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(190), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    selfie_url: Mapped[str | None] = mapped_column(String(500))
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    donor_profile: Mapped["DonorProfile | None"] = relationship(back_populates="user", uselist=False)
    recipient_profile: Mapped["RecipientProfile | None"] = relationship(back_populates="user", uselist=False)


class DonorProfile(Base):
    __tablename__ = "donor_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    donor_type: Mapped[DonorType] = mapped_column(Enum(DonorType), nullable=False)
    business_name: Mapped[str | None] = mapped_column(String(190))
    registration_number: Mapped[str | None] = mapped_column(String(100))
    event_details: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float, index=True)
    longitude: Mapped[float | None] = mapped_column(Float, index=True)

    user: Mapped[User] = relationship(back_populates="donor_profile")
    listings: Mapped[list["FoodListing"]] = relationship(back_populates="donor")


class RecipientProfile(Base):
    __tablename__ = "recipient_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    org_name: Mapped[str] = mapped_column(String(190), nullable=False)
    contact_person: Mapped[str] = mapped_column(String(120), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), nullable=False)
    org_photo_url: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float, index=True)
    longitude: Mapped[float | None] = mapped_column(Float, index=True)
    approval_status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), default=ApprovalStatus.pending)

    user: Mapped[User] = relationship(back_populates="recipient_profile")


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    channel: Mapped[OtpChannel] = mapped_column(Enum(OtpChannel), nullable=False)
    target: Mapped[str] = mapped_column(String(190), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class FoodListing(Base):
    __tablename__ = "food_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donor_profiles.id", ondelete="CASCADE"), index=True)
    food_name: Mapped[str] = mapped_column(String(190), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    quantity_kg: Mapped[float | None] = mapped_column(Float)
    servings: Mapped[int | None] = mapped_column(Integer)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True)
    food_photo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    cooked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    pickup_address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float, index=True)
    longitude: Mapped[float | None] = mapped_column(Float, index=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.available, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    donor: Mapped[DonorProfile] = relationship(back_populates="listings")
    requests: Mapped[list["DonationRequest"]] = relationship(back_populates="listing")


class DonationRequest(Base):
    __tablename__ = "donation_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("food_listings.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("recipient_profiles.id", ondelete="CASCADE"), index=True)
    initiated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), default=RequestStatus.pending, index=True)
    meeting_location: Mapped[str | None] = mapped_column(String(500))
    meeting_time: Mapped[datetime | None] = mapped_column(DateTime)
    donor_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    recipient_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    listing: Mapped[FoodListing] = relationship(back_populates="requests")
    recipient: Mapped[RecipientProfile] = relationship()
    qr: Mapped["DonationQR | None"] = relationship(back_populates="request", uselist=False, cascade="all, delete-orphan")


class DonationQR(Base):
    __tablename__ = "donation_qr"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("donation_requests.id", ondelete="CASCADE"), unique=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)
    scanned_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    request: Mapped[DonationRequest] = relationship(back_populates="qr")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("donation_requests.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(190), nullable=False)
    body: Mapped[str | None] = mapped_column(String(500))
    link: Mapped[str | None] = mapped_column(String(190))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
