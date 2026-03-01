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
        "description": "Update an existing task. Use task_id from list_tasks or find_tasks results. Optionally add a note.",
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
                "note": {"type": "string", "description": "Add a note to the task (appended, not replacing existing notes)"},
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
        "description": "Move/resize a calendar block to a new date or time, or rename it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "block_id": {"type": "string", "description": "Block ID to update"},
                "title": {"type": "string", "description": "New display title for the block"},
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
    {
        "name": "sync_google_calendar",
        "description": "Trigger a two-way sync with Google Calendar. Pushes Alfred blocks to Google and pulls Google events into Alfred.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days ahead to sync. Defaults to 14.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_google_events",
        "description": "Fetch events directly from Google Calendar for a date range. Useful for answering 'what's on my Google Calendar?'",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date (YYYY-MM-DD). Defaults to today.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date (YYYY-MM-DD). Defaults to start_date.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_calendar_event",
        "description": "Create a standalone calendar event (not linked to any task). Use this when the user says 'add an event/meeting/appointment' at a specific time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Event title"},
                "date": {"type": "string", "description": "Date (YYYY-MM-DD)"},
                "start_time": {"type": "string", "description": "Start time (HH:MM, 24-hour)"},
                "end_time": {"type": "string", "description": "End time (HH:MM, 24-hour)"},
            },
            "required": ["title", "date", "start_time", "end_time"],
        },
    },
    {
        "name": "schedule_task_as_event",
        "description": "Convert a task into a calendar event by creating a time block for it at a specific date and time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to schedule"},
                "date": {"type": "string", "description": "Date (YYYY-MM-DD)"},
                "start_time": {"type": "string", "description": "Start time (HH:MM, 24-hour)"},
                "end_time": {"type": "string", "description": "End time (HH:MM, 24-hour)"},
            },
            "required": ["task_id", "date", "start_time", "end_time"],
        },
    },
    {
        "name": "add_task_note",
        "description": "Add a note to a task. Use task_id from list_tasks or find_tasks results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID"},
                "content": {"type": "string", "description": "Note content"},
            },
            "required": ["task_id", "content"],
        },
    },
    {
        "name": "get_task_notes",
        "description": "Get all notes for a task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "add_block_note",
        "description": "Add a note to a calendar event/block.",
        "input_schema": {
            "type": "object",
            "properties": {
                "block_id": {"type": "string", "description": "Calendar block ID"},
                "content": {"type": "string", "description": "Note content"},
            },
            "required": ["block_id", "content"],
        },
    },
    {
        "name": "get_block_notes",
        "description": "Get all notes for a calendar event/block.",
        "input_schema": {
            "type": "object",
            "properties": {
                "block_id": {"type": "string", "description": "Calendar block ID"},
            },
            "required": ["block_id"],
        },
    },
    {
        "name": "save_memory",
        "description": "Save a fact, preference, or piece of information about the user to long-term memory. Use proactively when the user shares preferences, habits, or important context (e.g. 'I prefer mornings for deep work', 'I have a standing team meeting every Monday at 10am'). Do NOT re-save things already in memory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The fact or preference to remember"},
                "category": {
                    "type": "string",
                    "description": "Category: preference, habit, fact, schedule, or other",
                    "enum": ["preference", "habit", "fact", "schedule", "other"],
                },
            },
            "required": ["content"],
        },
    },
    {
        "name": "recall_memories",
        "description": "Search long-term memory for facts or preferences related to a query. Use when you need to recall something the user has told you previously.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query to find relevant memories"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "forget_memory",
        "description": "Remove a specific memory that is outdated or incorrect. Use memory_id from recall_memories results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string", "description": "Memory ID to forget"},
            },
            "required": ["memory_id"],
        },
    },
    {
        "name": "create_project",
        "description": "Create a new project to group related tasks. Projects help organize work by theme, client, or goal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Project name"},
                "description": {"type": "string", "description": "Brief description of the project"},
                "color": {"type": "string", "description": "Hex color code (e.g. #6366f1)"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "list_projects",
        "description": "List all projects with their task counts.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "add_task_to_project",
        "description": "Assign an existing task to a project. Use task_id from find_tasks and project_id from list_projects.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to assign"},
                "project_id": {"type": "string", "description": "Project ID to assign to"},
            },
            "required": ["task_id", "project_id"],
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
            case "sync_google_calendar":
                return await _exec_sync_google_calendar(tool_input, session, settings)
            case "get_google_events":
                return await _exec_get_google_events(tool_input, session, settings)
            case "create_calendar_event":
                return await _exec_create_calendar_event(tool_input, session)
            case "schedule_task_as_event":
                return await _exec_schedule_task_as_event(tool_input, session)
            case "add_task_note":
                return await _exec_add_task_note(tool_input, session)
            case "get_task_notes":
                return await _exec_get_task_notes(tool_input, session)
            case "add_block_note":
                return await _exec_add_block_note(tool_input, session)
            case "get_block_notes":
                return await _exec_get_block_notes(tool_input, session)
            case "save_memory":
                return await _exec_save_memory(tool_input, session)
            case "recall_memories":
                return await _exec_recall_memories(tool_input, session)
            case "forget_memory":
                return await _exec_forget_memory(tool_input, session)
            case "create_project":
                return await _exec_create_project(tool_input, session)
            case "list_projects":
                return await _exec_list_projects(tool_input, session)
            case "add_task_to_project":
                return await _exec_add_task_to_project(tool_input, session)
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
        "task_title": block.title or (block.task.title if block.task else "Unknown"),
        "scheduled_date": block.scheduled_date.isoformat(),
        "start_time": block.start_time.strftime("%H:%M"),
        "end_time": block.end_time.strftime("%H:%M"),
        "duration_minutes": block.duration_minutes,
        "is_locked": block.is_locked,
        "status": block.status.value,
        "source": getattr(block, "source", "alfred"),
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
    task_id = inp["task_id"]
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

    if inp.get("note"):
        await task_service.add_note(task_id, inp["note"], session, source="alfred")

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
    block_id = inp["block_id"]
    update_data = {}
    if "title" in inp:
        update_data["title"] = inp["title"]
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


async def _exec_sync_google_calendar(
    inp: dict, session: AsyncSession, settings: Settings
) -> dict:
    from app.services import google_calendar_service as gcal

    days = inp.get("days_ahead", 14)
    result = await gcal.sync(session, settings, days_ahead=days)
    return result


async def _exec_get_google_events(
    inp: dict, session: AsyncSession, settings: Settings
) -> dict:
    from app.services import google_calendar_service as gcal

    tz = ZoneInfo(settings.timezone)
    if inp.get("start_date"):
        start = date.fromisoformat(inp["start_date"])
    else:
        start = datetime.now(tz).date()

    end = date.fromisoformat(inp["end_date"]) if inp.get("end_date") else start

    events = await gcal.pull_events_from_google(start, end, session, settings)
    return {
        "events": [
            {
                "id": e.get("id"),
                "summary": e.get("summary", "No title"),
                "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
                "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
                "location": e.get("location"),
            }
            for e in events
        ],
        "count": len(events),
    }


async def _exec_create_calendar_event(inp: dict, session: AsyncSession) -> dict:
    from datetime import time as time_type

    start_parts = inp["start_time"].split(":")
    end_parts = inp["end_time"].split(":")
    start_time = time_type(int(start_parts[0]), int(start_parts[1]))
    end_time = time_type(int(end_parts[0]), int(end_parts[1]))
    event_date = date.fromisoformat(inp["date"])

    block = await calendar_service.create_block(
        CalendarBlockCreate(
            task_id=None,
            title=inp["title"],
            scheduled_date=event_date,
            start_time=start_time,
            end_time=end_time,
            is_locked=False,
        ),
        session,
    )
    return {"created": _block_to_dict(block)}


async def _exec_schedule_task_as_event(inp: dict, session: AsyncSession) -> dict:
    from datetime import time as time_type

    start_parts = inp["start_time"].split(":")
    end_parts = inp["end_time"].split(":")
    start_time = time_type(int(start_parts[0]), int(start_parts[1]))
    end_time = time_type(int(end_parts[0]), int(end_parts[1]))
    event_date = date.fromisoformat(inp["date"])

    block = await calendar_service.create_block(
        CalendarBlockCreate(
            task_id=inp["task_id"],
            scheduled_date=event_date,
            start_time=start_time,
            end_time=end_time,
            is_locked=True,
        ),
        session,
    )
    return {"created": _block_to_dict(block)}


async def _exec_add_task_note(inp: dict, session: AsyncSession) -> dict:
    note = await task_service.add_note(inp["task_id"], inp["content"], session, source="alfred")
    if not note:
        return {"error": f"Task {inp['task_id']} not found"}
    return {"added": {"id": note.id, "content": note.content}}


async def _exec_get_task_notes(inp: dict, session: AsyncSession) -> dict:
    task = await task_service.get_task(inp["task_id"], session)
    if not task:
        return {"error": f"Task {inp['task_id']} not found"}
    notes = [{"id": n.id, "content": n.content, "source": n.source} for n in (task.notes or [])]
    return {"notes": notes, "count": len(notes)}


async def _exec_add_block_note(inp: dict, session: AsyncSession) -> dict:
    note = await calendar_service.add_note(inp["block_id"], inp["content"], session, source="alfred")
    if not note:
        return {"error": f"Block {inp['block_id']} not found"}
    return {"added": {"id": note.id, "content": note.content}}


async def _exec_get_block_notes(inp: dict, session: AsyncSession) -> dict:
    block = await calendar_service.get_block_detail(inp["block_id"], session)
    if not block:
        return {"error": f"Block {inp['block_id']} not found"}
    notes = [{"id": n.id, "content": n.content, "source": n.source} for n in (block.notes or [])]
    return {"notes": notes, "count": len(notes)}


async def _exec_save_memory(inp: dict, session: AsyncSession) -> dict:
    from app.services import memory_service
    mem = await memory_service.create_memory(
        content=inp["content"],
        session=session,
        category=inp.get("category"),
    )
    return {"saved": {"id": mem.id, "content": mem.content, "category": mem.category}}


async def _exec_recall_memories(inp: dict, session: AsyncSession) -> dict:
    from app.services import memory_service
    memories = await memory_service.search_memories(inp["query"], session)
    return {
        "memories": [
            {"id": m.id, "content": m.content, "category": m.category}
            for m in memories
        ],
        "count": len(memories),
    }


async def _exec_forget_memory(inp: dict, session: AsyncSession) -> dict:
    from app.services import memory_service
    forgotten = await memory_service.forget_memory(inp["memory_id"], session)
    if not forgotten:
        return {"error": f"Memory {inp['memory_id']} not found"}
    return {"forgotten": True, "memory_id": inp["memory_id"]}


async def _exec_create_project(inp: dict, session: AsyncSession) -> dict:
    from app.services import project_service
    from app.schemas.project import ProjectCreate

    data = ProjectCreate(
        title=inp["title"],
        description=inp.get("description"),
        color=inp.get("color", "#6366f1"),
    )
    proj = await project_service.create_project(data, session)
    return {"created": {"id": proj.id, "title": proj.title, "color": proj.color}}


async def _exec_list_projects(inp: dict, session: AsyncSession) -> dict:
    from app.services import project_service

    projects = await project_service.list_projects(session)
    result = []
    for p in projects:
        count = await project_service.get_task_count(p.id, session)
        result.append({"id": p.id, "title": p.title, "color": p.color, "task_count": count})
    return {"projects": result, "count": len(result)}


async def _exec_add_task_to_project(inp: dict, session: AsyncSession) -> dict:
    from app.services import project_service

    task = await project_service.assign_task_to_project(inp["task_id"], inp["project_id"], session)
    if not task:
        return {"error": f"Task {inp['task_id']} not found"}
    return {"assigned": True, "task_id": task.id, "project_id": inp["project_id"]}
