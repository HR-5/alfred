import enum
import uuid
from datetime import date, time
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, Integer, String, Table, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.task import Task


class BlockStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Many-to-many junction table for tagging tasks to blocks
block_tagged_tasks = Table(
    "block_tagged_tasks",
    Base.metadata,
    Column("block_id", String(36), ForeignKey("calendar_blocks.id", ondelete="CASCADE"), primary_key=True),
    Column("task_id", String(36), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
)


class CalendarBlock(Base, TimestampMixin):
    __tablename__ = "calendar_blocks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )
    scheduled_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[BlockStatus] = mapped_column(
        Enum(BlockStatus), default=BlockStatus.SCHEDULED
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(50), default="alfred")
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    task: Mapped["Task"] = relationship(back_populates="calendar_blocks")
    tagged_tasks: Mapped[list["Task"]] = relationship(secondary=block_tagged_tasks)
    notes: Mapped[list["BlockNote"]] = relationship(back_populates="block", cascade="all, delete-orphan")


class BlockNote(Base, TimestampMixin):
    __tablename__ = "block_notes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    block_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calendar_blocks.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="user")

    block: Mapped["CalendarBlock"] = relationship(back_populates="notes")
