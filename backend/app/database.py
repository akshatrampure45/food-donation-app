from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

url = settings.database_url
connect_args = {}
if url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif settings.DB_SSL_CA and not settings.DATABASE_URL:
    connect_args["ssl"] = {"ca": settings.DB_SSL_CA}

engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True, pool_recycle=280)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
