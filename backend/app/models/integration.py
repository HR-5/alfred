import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class GoogleCalendarAuth(Base, TimestampMixin):
    __tablename__ = "google_calendar_auth"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    calendar_id: Mapped[str] = mapped_column(String(255), default="primary")
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
