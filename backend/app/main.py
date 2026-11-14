from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models  # noqa: F401
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.routers import auth, listings, misc, requests
from app.security import hash_password


def seed_admin():
    if not (settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD):
        return
    db = SessionLocal()
    try:
        email = settings.ADMIN_EMAIL.strip().strip("<>").lower()
        password = settings.ADMIN_PASSWORD.strip()
        admin = db.query(User).filter(User.role == UserRole.admin).first()
        if admin:
            clash = db.query(User).filter(User.email == email, User.id != admin.id).first()
            if clash:
                print(f"Admin email {email} is already used by another account. Admin not updated.")
                return
            admin.email = email
            admin.password_hash = hash_password(password)
            db.commit()
            print(f"Admin account updated: {email}")
        else:
            db.add(User(role=UserRole.admin, name="Admin", email=email, phone="0000000000",
                        password_hash=hash_password(password),
                        phone_verified=True, email_verified=True))
            db.commit()
            print(f"Admin account created: {email}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_admin()
    yield


app = FastAPI(title="Food Donation Platform API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(requests.router)
app.include_router(misc.router)


@app.get("/")
def root():
    return {"message": "Food Donation Platform API is running", "docs": "/docs"}


@app.get("/health")
def health():
    with engine.connect() as c:
        c.execute(text("SELECT 1"))
    return {"status": "ok"}