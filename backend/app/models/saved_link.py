import enum
import uuid

from sqlalchemy import Boolean, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LinkType(str, enum.Enum):
    ARTICLE = "article"
    VIDEO = "video"
    BOOK = "book"
    PODCAST = "podcast"
    OTHER = "other"


class SavedLink(Base, TimestampMixin):
    __tablename__ = "saved_links"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_type: Mapped[LinkType] = mapped_column(
        Enum(LinkType), default=LinkType.OTHER
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
