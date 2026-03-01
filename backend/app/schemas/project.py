from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    notes: Optional[str] = None
    color: str = "#6366f1"


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    notes: Optional[str]
    color: str
    created_at: datetime
    task_count: int = 0

    model_config = {"from_attributes": True}


class ProjectTaskResponse(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    due_date: Optional[str] = None

    model_config = {"from_attributes": True}
