from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.task import EnergyLevel, Priority, RecurrenceType, TaskStatus


class TaskNoteResponse(BaseModel):
    id: str
    content: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: Priority = Priority.NONE
    energy_level: Optional[EnergyLevel] = None
    category: Optional[str] = None
    context: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    estimated_minutes: Optional[int] = None
    recurrence_type: RecurrenceType = RecurrenceType.NONE
    source: str = "chat"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    energy_level: Optional[EnergyLevel] = None
    category: Optional[str] = None
    context: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    estimated_minutes: Optional[int] = None
    recurrence_type: Optional[RecurrenceType] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: Priority
    energy_level: Optional[EnergyLevel]
    category: Optional[str]
    context: Optional[str]
    due_date: Optional[date]
    due_time: Optional[str]
    estimated_minutes: Optional[int]
    recurrence_type: RecurrenceType
    times_snoozed: int
    times_rescheduled: int
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    notes: list[TaskNoteResponse] = []

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    total: int
