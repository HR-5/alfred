from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.task import TaskResponse


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class QuickAction(BaseModel):
    label: str
    action: str  # e.g. "complete_task", "snooze_task"
    payload: dict[str, Any] = {}


class ChatResponse(BaseModel):
    reply: str
    intent_type: Optional[str] = None
    tasks: Optional[list[TaskResponse]] = None
    task: Optional[TaskResponse] = None
    quick_actions: Optional[list[QuickAction]] = None
    needs_confirmation: bool = False
    confirmation_data: Optional[dict[str, Any]] = None
    actions_taken: Optional[list[str]] = None
