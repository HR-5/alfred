import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LinkedInConnection(Base, TimestampMixin):
    __tablename__ = "linkedin_connections"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200))
    profile_url: Mapped[str] = mapped_column(String(500))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
