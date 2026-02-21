from datetime import date, time
from typing import Optional

from pydantic import BaseModel

from app.models.calendar_block import BlockStatus


class CalendarBlockResponse(BaseModel):
    id: str
    task_id: str
    scheduled_date: date
    start_time: time
    end_time: time
    duration_minutes: int
    status: BlockStatus
    is_locked: bool
    # Denormalized task fields for rendering
    task_title: str
    task_priority: str
    task_energy_level: Optional[str]
    task_status: str

    model_config = {"from_attributes": True}


class CalendarBlockCreate(BaseModel):
    task_id: str
    scheduled_date: date
    start_time: time
    end_time: time
    is_locked: bool = True


class CalendarBlockUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_locked: Optional[bool] = None
    status: Optional[BlockStatus] = None


class WeekScheduleRequest(BaseModel):
    week_start: date
    force_reschedule: bool = False


class WeekScheduleResponse(BaseModel):
    blocks: list[CalendarBlockResponse]
    week_start: date
    week_end: date
    tasks_scheduled: int
    tasks_unschedulable: int
    unschedulable_task_ids: list[str]
