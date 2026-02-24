import json
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Priority, RecurrenceType, Task, TaskNote, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


async def create_task(data: TaskCreate, session: AsyncSession) -> Task:
    task = Task(**data.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task, ["notes"])
    return task


async def get_task(task_id: str, session: AsyncSession) -> Optional[Task]:
    result = await session.execute(
        select(Task).where(Task.id == task_id).options(selectinload(Task.notes))
    )
    return result.scalar_one_or_none()


async def list_tasks(
    session: AsyncSession,
    *,
    status: Optional[list[str]] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    due_before: Optional[date] = None,
    due_after: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Task], int]:
    query = select(Task).options(selectinload(Task.notes))
    conditions = []

    if status:
        conditions.append(Task.status.in_([TaskStatus(s) for s in status]))
    else:
        # By default, exclude cancelled tasks
        conditions.append(Task.status != TaskStatus.CANCELLED)

    if priority:
        conditions.append(Task.priority == Priority(priority))
    if category:
        conditions.append(Task.category == category)
    if due_before:
        conditions.append(Task.due_date <= due_before)
    if due_after:
        conditions.append(Task.due_date >= due_after)
    if search:
        conditions.append(Task.title.ilike(f"%{search}%"))

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Task.due_date.asc().nulls_last(), Task.due_time.asc().nulls_last(), Task.created_at.desc())

    count_result = await session.execute(
        select(Task).where(and_(*conditions)) if conditions else select(Task)
    )
    total = len(count_result.scalars().all())

    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return result.scalars().all(), total


async def update_task(
    task_id: str, data: TaskUpdate, session: AsyncSession
) -> Optional[Task]:
    task = await get_task(task_id, session)
    if not task:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    task.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(task, ["notes"])
    return task


async def delete_task(task_id: str, session: AsyncSession) -> bool:
    task = await get_task(task_id, session)
    if not task:
        return False
    await session.delete(task)
    await session.commit()
    return True


async def complete_task(task_id: str, session: AsyncSession) -> Optional[Task]:
    task = await get_task(task_id, session)
    if not task:
        return None
    task.status = TaskStatus.DONE
    task.completed_at = datetime.now(timezone.utc)
    task.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(task, ["notes"])
    return task


async def snooze_task(
    task_id: str,
    snooze_minutes: int,
    session: AsyncSession,
) -> Optional[Task]:
    from datetime import timedelta
    task = await get_task(task_id, session)
    if not task:
        return None
    task.status = TaskStatus.SNOOZED
    task.snoozed_until = datetime.now(timezone.utc) + timedelta(minutes=snooze_minutes)
    task.times_snoozed += 1
    task.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(task, ["notes"])
    return task


async def add_note(
    task_id: str, content: str, session: AsyncSession, source: str = "user"
) -> Optional[TaskNote]:
    task = await get_task(task_id, session)
    if not task:
        return None
    note = TaskNote(task_id=task_id, content=content, source=source)
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def find_by_fuzzy_title(
    title_query: str, session: AsyncSession, limit: int = 5
) -> list[Task]:
    """Find tasks whose title contains the query string (case-insensitive)."""
    result = await session.execute(
        select(Task)
        .where(
            and_(
                Task.title.ilike(f"%{title_query}%"),
                Task.status != TaskStatus.CANCELLED,
            )
        )
        .options(selectinload(Task.notes))
        .limit(limit)
    )
    return result.scalars().all()


async def create_from_intent_entities(
    entities: dict[str, Any], session: AsyncSession
) -> Task:
    """Create a Task from the entities dict extracted by the intent engine."""
    priority_map = {
        "critical": Priority.CRITICAL,
        "high": Priority.HIGH,
        "medium": Priority.MEDIUM,
        "low": Priority.LOW,
    }
    recurrence_map = {
        "daily": RecurrenceType.DAILY,
        "weekly": RecurrenceType.WEEKLY,
        "biweekly": RecurrenceType.BIWEEKLY,
        "monthly": RecurrenceType.MONTHLY,
    }

    due_date = None
    if entities.get("due_date"):
        try:
            due_date = date.fromisoformat(str(entities["due_date"]))
        except (ValueError, TypeError):
            pass

    priority_raw = entities.get("priority")
    priority = priority_map.get(str(priority_raw).lower()) if priority_raw else Priority.NONE

    recurrence_raw = entities.get("recurrence")
    recurrence = recurrence_map.get(str(recurrence_raw).lower()) if recurrence_raw else RecurrenceType.NONE

    data = TaskCreate(
        title=entities.get("title", "Untitled task"),
        priority=priority,
        due_date=due_date,
        due_time=entities.get("due_time"),
        estimated_minutes=entities.get("estimated_minutes"),
        category=entities.get("category"),
        recurrence_type=recurrence,
        source="chat",
    )
    return await create_task(data, session)
