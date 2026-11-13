from sqlalchemy.orm import Session

from app.models import Notification
from app.utils import utcnow


def notify(db: Session, user_id: int, title: str, body: str | None = None, link: str | None = None):
    db.add(Notification(user_id=user_id, title=title[:190], body=(body or "")[:500] or None, link=link, created_at=utcnow()))
