import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"
    SNOOZED = "snoozed"


class Priority(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class EnergyLevel(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecurrenceType(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.TODO)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.NONE)
    energy_level: Mapped[Optional[EnergyLevel]] = mapped_column(
        Enum(EnergyLevel), nullable=True
    )
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    context: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Dates
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Scheduling
    estimated_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actual_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Recurrence
    recurrence_type: Mapped[RecurrenceType] = mapped_column(
        Enum(RecurrenceType), default=RecurrenceType.NONE
    )
    recurrence_interval: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recurrence_days: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    recurrence_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    parent_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("tasks.id"), nullable=True
    )

    # Behavioral tracking
    times_snoozed: Mapped[int] = mapped_column(Integer, default=0)
    times_rescheduled: Mapped[int] = mapped_column(Integer, default=0)
    original_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    source: Mapped[str] = mapped_column(String(50), default="chat")
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    notes: Mapped[list["TaskNote"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskNote(Base, TimestampMixin):
    __tablename__ = "task_notes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="user")

    task: Mapped["Task"] = relationship(back_populates="notes")
