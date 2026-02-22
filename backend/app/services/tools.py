"""
Tool definitions and executor for the agentic chat loop.

Each tool is an Anthropic-format tool definition + a corresponding executor function.
"""

import json
import logging
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import task_service, calendar_service
from app.services.scheduler import schedule_week
from app.schemas.task import TaskCreate, TaskUpdate
from app.schemas.calendar import CalendarBlockCreate, CalendarBlockUpdate
from app.models.task import Priority, EnergyLevel, RecurrenceType

logger = logging.getLogger(__name__)


# ─── Tool Definitions (Anthropic format) ────────────────────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "list_tasks",
        "description": "List/query tasks with optional filters. Returns matching tasks with their IDs, titles, status, priority, due dates, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["todo", "in_progress", "done", "cancelled", "snoozed"]},
                    "description": "Filter by task status(es)",
                },
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low", "none"],
                    "description": "Filter by priority level",
                },
                "due_date": {
                    "type": "string",
                    "description": "Filter tasks due on this date (YYYY-MM-DD)",
                },
                "due_before": {
                    "type": "string",
                    "description": "Filter tasks due before this date (YYYY-MM-DD)",
                },
                "due_after": {
                    "type": "string",
                    "description": "Filter tasks due after this date (YYYY-MM-DD)",
                },
                "search": {
                    "type": "string",
                    "description": "Search tasks by title (fuzzy match)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_task",
        "description": "Create a new task. After creation, automatically schedules it on the calendar.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Task title"},
                "due_date": {"type": "string", "description": "Due date (YYYY-MM-DD)"},
                "due_time": {"type": "string", "description": "Due time (HH:MM, 24-hour format)"},
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low", "none"],
                },
                "estimated_minutes": {
                    "type": "integer",
                    "description": "Estimated duration in minutes",
                },
                "category": {"type": "string", "description": "Task category"},
                "energy_level": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                    "description": "Energy level required",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "update_task",
        "description": "Update an existing task. Use task_id from list_tasks or find_tasks results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to update"},
                "title": {"type": "string"},
                "due_date": {"type": "string", "description": "New due date (YYYY-MM-DD)"},
                "due_time": {"type": "string", "description": "New due time (HH:MM)"},
                "priority": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low", "none"],
                },
                "estimated_minutes": {"type": "integer"},
                "category": {"type": "string"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "delete_task",
        "description": "Permanently delete a task and its calendar blocks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to delete"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "complete_task",
        "description": "Mark a task as done/completed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to complete"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "find_tasks",
        "description": "Fuzzy-search tasks by title. Use this to find task IDs when the user refers to tasks by name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (part of task title)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_calendar_blocks",
        "description": "Get calendar blocks (scheduled time slots) for a date or date range. Returns block IDs, task info, times.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date (YYYY-MM-DD). Defaults to today.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date (YYYY-MM-DD). Defaults to start_date (single day).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "delete_calendar_block",
        "description": "Remove a calendar block (time slot). The underlying task is NOT deleted.",
        "input_schema": {
            "type": "object",
            "properties": {
                "block_id": {"type": "string", "description": "Calendar block ID to delete"},
            },
            "required": ["block_id"],
        },
    },
    {
        "name": "update_calendar_block",
        "description": "Move/resize a calendar block to a new date or time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "block_id": {"type": "string", "description": "Block ID to update"},
                "scheduled_date": {"type": "string", "description": "New date (YYYY-MM-DD)"},
                "start_time": {"type": "string", "description": "New start time (HH:MM)"},
                "end_time": {"type": "string", "description": "New end time (HH:MM)"},
            },
            "required": ["block_id"],
        },
    },
    {
        "name": "schedule_week",
        "description": "Run the auto-scheduler for a week. Creates calendar blocks for unscheduled tasks based on priority, deadlines, and energy levels.",
        "input_schema": {
            "type": "object",
            "properties": {
                "week_start": {
                    "type": "string",
                    "description": "Monday of the week to schedule (YYYY-MM-DD). Defaults to current week.",
                },
                "force_reschedule": {
                    "type": "boolean",
                    "description": "If true, clears non-locked blocks and reschedules everything",
                },
            },
            "required": [],
        },
    },
]


# ─── Tool Executor ──────────────────────────────────────────────────────────

async def execute_tool(
    name: str,
    tool_input: dict[str, Any],
    session: AsyncSession,
    settings: Settings,
) -> dict[str, Any]:
    """Execute a tool call and return the result as a serializable dict."""
    try:
        match name:
            case "list_tasks":
                return await _exec_list_tasks(tool_input, session)
            case "create_task":
                return await _exec_create_task(tool_input, session, settings)
            case "update_task":
                return await _exec_update_task(tool_input, session)
            case "delete_task":
                return await _exec_delete_task(tool_input, session)
            case "complete_task":
                return await _exec_complete_task(tool_input, session)
            case "find_tasks":
                return await _exec_find_tasks(tool_input, session)
            case "get_calendar_blocks":
                return await _exec_get_calendar_blocks(tool_input, session, settings)
            case "delete_calendar_block":
                return await _exec_delete_calendar_block(tool_input, session)
            case "update_calendar_block":
                return await _exec_update_calendar_block(tool_input, session)
            case "schedule_week":
                return await _exec_schedule_week(tool_input, session, settings)
            case _:
                return {"error": f"Unknown tool: {name}"}
    except Exception as exc:
        logger.error("Tool %s failed: %s", name, exc)
        return {"error": str(exc)}


# ─── Individual Tool Executors ──────────────────────────────────────────────

def _task_to_dict(task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status.value,
        "priority": task.priority.value,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_time": task.due_time,
        "estimated_minutes": task.estimated_minutes,
        "category": task.category,
        "energy_level": task.energy_level.value if task.energy_level else None,
    }


def _block_to_dict(block) -> dict:
    return {
        "id": block.id,
        "task_id": block.task_id,
        "task_title": block.task.title if block.task else "Unknown",
        "scheduled_date": block.scheduled_date.isoformat(),
        "start_time": block.start_time.strftime("%H:%M"),
        "end_time": block.end_time.strftime("%H:%M"),
        "duration_minutes": block.duration_minutes,
        "is_locked": block.is_locked,
        "status": block.status.value,
    }


async def _exec_list_tasks(inp: dict, session: AsyncSession) -> dict:
    due_before = None
    due_after = None
    due_date = inp.get("due_date")

    if due_date:
        d = date.fromisoformat(due_date)
        due_before = d
        due_after = d
    else:
        if inp.get("due_before"):
            due_before = date.fromisoformat(inp["due_before"])
        if inp.get("due_after"):
            due_after = date.fromisoformat(inp["due_after"])

    tasks, total = await task_service.list_tasks(
        session,
        status=inp.get("status"),
        priority=inp.get("priority"),
        due_before=due_before,
        due_after=due_after,
        search=inp.get("search"),
        limit=50,
    )
    return {
        "tasks": [_task_to_dict(t) for t in tasks],
        "total": total,
    }


async def _exec_create_task(inp: dict, session: AsyncSession, settings: Settings) -> dict:
    priority_map = {
        "critical": Priority.CRITICAL,
        "high": Priority.HIGH,
        "medium": Priority.MEDIUM,
        "low": Priority.LOW,
        "none": Priority.NONE,
    }
    energy_map = {
        "high": EnergyLevel.HIGH,
        "medium": EnergyLevel.MEDIUM,
        "low": EnergyLevel.LOW,
    }

    due_date = None
    if inp.get("due_date"):
        due_date = date.fromisoformat(inp["due_date"])

    data = TaskCreate(
        title=inp["title"],
        due_date=due_date,
        due_time=inp.get("due_time"),
        priority=priority_map.get(inp.get("priority", "none"), Priority.NONE),
        estimated_minutes=inp.get("estimated_minutes"),
        category=inp.get("category"),
        energy_level=energy_map.get(inp.get("energy_level", ""), None),
        source="chat",
    )
    task = await task_service.create_task(data, session)

    # Auto-schedule onto the calendar
    await _auto_schedule_task(task, session, settings)

    return {"created": _task_to_dict(task)}


async def _auto_schedule_task(task, session: AsyncSession, settings: Settings) -> None:
    """Schedule a newly created task on the calendar."""
    try:
        from app.schemas.calendar import CalendarBlockCreate
        from datetime import time as time_type

        if task.due_date and task.due_time:
            parts = task.due_time.split(":")
            start_time = time_type(int(parts[0]), int(parts[1]))
            duration = task.estimated_minutes or settings.default_task_duration_min
            end_minutes = int(parts[0]) * 60 + int(parts[1]) + duration
            end_time = time_type(end_minutes // 60, end_minutes % 60)

            await calendar_service.create_block(
                CalendarBlockCreate(
                    task_id=task.id,
                    scheduled_date=task.due_date,
                    start_time=start_time,
                    end_time=end_time,
                    is_locked=True,
                ),
                session,
            )
            return

        tz = ZoneInfo(settings.timezone)
        today = datetime.now(tz).date()
        weekday = today.weekday()
        week_start = today - timedelta(days=weekday)

        if task.due_date and task.due_date > week_start + timedelta(days=6):
            target_weekday = task.due_date.weekday()
            week_start = task.due_date - timedelta(days=target_weekday)

        await schedule_week(
            week_start=week_start,
            session=session,
            settings=settings,
            force_reschedule=False,
        )
    except Exception as exc:
        logger.warning("Auto-scheduling failed for task %s: %s", task.id, exc)


async def _exec_update_task(inp: dict, session: AsyncSession) -> dict:
    task_id = inp.pop("task_id")
    update_fields = {}
    if "title" in inp:
        update_fields["title"] = inp["title"]
    if "due_date" in inp:
        update_fields["due_date"] = date.fromisoformat(inp["due_date"])
    if "due_time" in inp:
        update_fields["due_time"] = inp["due_time"]
    if "priority" in inp:
        update_fields["priority"] = Priority(inp["priority"])
    if "estimated_minutes" in inp:
        update_fields["estimated_minutes"] = inp["estimated_minutes"]
    if "category" in inp:
        update_fields["category"] = inp["category"]

    task = await task_service.update_task(task_id, TaskUpdate(**update_fields), session)
    if not task:
        return {"error": f"Task {task_id} not found"}
    return {"updated": _task_to_dict(task)}


async def _exec_delete_task(inp: dict, session: AsyncSession) -> dict:
    task = await task_service.get_task(inp["task_id"], session)
    title = task.title if task else "Unknown"
    deleted = await task_service.delete_task(inp["task_id"], session)
    if not deleted:
        return {"error": f"Task {inp['task_id']} not found"}
    return {"deleted": True, "title": title}


async def _exec_complete_task(inp: dict, session: AsyncSession) -> dict:
    task = await task_service.complete_task(inp["task_id"], session)
    if not task:
        return {"error": f"Task {inp['task_id']} not found"}
    return {"completed": _task_to_dict(task)}


async def _exec_find_tasks(inp: dict, session: AsyncSession) -> dict:
    tasks = await task_service.find_by_fuzzy_title(inp["query"], session)
    return {"tasks": [_task_to_dict(t) for t in tasks]}


async def _exec_get_calendar_blocks(
    inp: dict, session: AsyncSession, settings: Settings
) -> dict:
    tz = ZoneInfo(settings.timezone)
    if inp.get("start_date"):
        start = date.fromisoformat(inp["start_date"])
    else:
        start = datetime.now(tz).date()

    end = date.fromisoformat(inp["end_date"]) if inp.get("end_date") else start

    # get_week_blocks works with week ranges; we query the full span
    # by iterating needed weeks
    all_blocks = []
    current = start
    while current <= end:
        weekday = current.weekday()
        week_start = current - timedelta(days=weekday)
        blocks = await calendar_service.get_week_blocks(week_start, session)
        for b in blocks:
            if start <= b.scheduled_date <= end and b not in all_blocks:
                all_blocks.append(b)
        current = week_start + timedelta(days=7)

    return {"blocks": [_block_to_dict(b) for b in all_blocks]}


async def _exec_delete_calendar_block(inp: dict, session: AsyncSession) -> dict:
    block = await calendar_service.get_block(inp["block_id"], session)
    title = block.task.title if block and block.task else "Unknown"
    deleted = await calendar_service.delete_block(inp["block_id"], session)
    if not deleted:
        return {"error": f"Block {inp['block_id']} not found"}
    return {"deleted": True, "task_title": title}


async def _exec_update_calendar_block(inp: dict, session: AsyncSession) -> dict:
    block_id = inp.pop("block_id")
    update_data = {}
    if "scheduled_date" in inp:
        update_data["scheduled_date"] = date.fromisoformat(inp["scheduled_date"])
    if "start_time" in inp:
        parts = inp["start_time"].split(":")
        update_data["start_time"] = time(int(parts[0]), int(parts[1]))
    if "end_time" in inp:
        parts = inp["end_time"].split(":")
        update_data["end_time"] = time(int(parts[0]), int(parts[1]))

    block = await calendar_service.update_block(
        block_id, CalendarBlockUpdate(**update_data), session
    )
    if not block:
        return {"error": f"Block {block_id} not found"}
    return {"updated": _block_to_dict(block)}


async def _exec_schedule_week(
    inp: dict, session: AsyncSession, settings: Settings
) -> dict:
    tz = ZoneInfo(settings.timezone)
    if inp.get("week_start"):
        week_start = date.fromisoformat(inp["week_start"])
    else:
        today = datetime.now(tz).date()
        weekday = today.weekday()
        week_start = today - timedelta(days=weekday)

    force = inp.get("force_reschedule", False)
    result = await schedule_week(
        week_start=week_start,
        session=session,
        settings=settings,
        force_reschedule=force,
    )
    return {
        "scheduled_count": result["tasks_scheduled"],
        "unschedulable_count": result["tasks_unschedulable"],
        "total_blocks": len(result["blocks"]),
    }
