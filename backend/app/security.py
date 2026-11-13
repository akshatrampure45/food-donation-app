from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.utils import utcnow

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "exp": utcnow() + timedelta(days=settings.ACCESS_TOKEN_DAYS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Please log in")
    try:
        data = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        user = db.get(User, int(data["sub"]))
    except Exception:
        raise HTTPException(401, "Session expired. Please log in again")
    if not user or not user.is_active:
        raise HTTPException(401, "Account not found")
    if not (user.phone_verified and user.email_verified):
        raise HTTPException(403, "Please verify your phone and email")
    return user


def require_role(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You are not allowed to do this")
        return user
    return checker
