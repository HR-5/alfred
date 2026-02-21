from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class IntentType(str, Enum):
    ADD_TASK = "add_task"
    EDIT_TASK = "edit_task"
    DELETE_TASK = "delete_task"
    QUERY_TASKS = "query_tasks"
    COMPLETE_TASK = "complete_task"
    RESCHEDULE_TASK = "reschedule_task"
    SNOOZE_TASK = "snooze_task"
    ADD_NOTE = "add_note"
    SET_REMINDER = "set_reminder"
    GET_PLAN = "get_plan"
    GET_REVIEW = "get_review"
    GET_INSIGHTS = "get_insights"
    CONVERSATIONAL = "conversational"
    AMBIGUOUS = "ambiguous"


class ParsedIntent(BaseModel):
    intent_type: IntentType = Field(description="The classified intent of the user message")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0–1.0")
    entities: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Extracted entities. For add_task: title, due_date (YYYY-MM-DD), due_time (HH:MM), "
            "priority (critical/high/medium/low/null), estimated_minutes (int/null), "
            "category (string/null), recurrence (daily/weekly/null), energy_level (high/medium/low/null). "
            "For task references: task_ref (string). "
            "For reschedule: new_date (YYYY-MM-DD), new_time (HH:MM). "
            "For snooze/reminder: snooze_minutes (int), remind_at (ISO datetime). "
            "For query: filter_status, filter_priority, filter_date. "
            "For note: note_content (string)."
        ),
    )
    clarification_needed: Optional[str] = Field(
        default=None,
        description="Question to ask user if intent is ambiguous or info is missing",
    )
