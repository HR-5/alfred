from datetime import date, time, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.calendar_block import BlockNote, BlockStatus, CalendarBlock, block_tagged_tasks
from app.models.task import Task
from app.schemas.calendar import CalendarBlockCreate, CalendarBlockUpdate


async def get_week_blocks(
    week_start: date,
    session: AsyncSession,
) -> list[CalendarBlock]:
    week_end = week_start + timedelta(days=6)
    result = await session.execute(
        select(CalendarBlock)
        .where(
            and_(
                CalendarBlock.scheduled_date >= week_start,
                CalendarBlock.scheduled_date <= week_end,
                CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
            )
        )
        .options(selectinload(CalendarBlock.task))
        .order_by(CalendarBlock.scheduled_date, CalendarBlock.start_time)
    )
    return list(result.scalars().all())


async def get_block(block_id: str, session: AsyncSession) -> Optional[CalendarBlock]:
    result = await session.execute(
        select(CalendarBlock)
        .where(CalendarBlock.id == block_id)
        .options(selectinload(CalendarBlock.task))
    )
    return result.scalar_one_or_none()


async def create_block(data: CalendarBlockCreate, session: AsyncSession) -> CalendarBlock:
    from datetime import datetime

    start_dt = datetime.combine(data.scheduled_date, data.start_time)
    end_dt = datetime.combine(data.scheduled_date, data.end_time)
    duration = int((end_dt - start_dt).total_seconds()) // 60

    overlap = await _has_overlap(
        data.scheduled_date, data.start_time, data.end_time, session
    )
    if overlap:
        raise ValueError("Time slot overlaps with an existing block")

    block = CalendarBlock(
        task_id=data.task_id,
        title=data.title if data.title else None,
        scheduled_date=data.scheduled_date,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=duration,
        status=BlockStatus.CONFIRMED if data.is_locked else BlockStatus.SCHEDULED,
        is_locked=data.is_locked,
    )
    session.add(block)
    await session.commit()
    await session.refresh(block)
    # Load task relationship
    result = await session.execute(
        select(CalendarBlock)
        .where(CalendarBlock.id == block.id)
        .options(selectinload(CalendarBlock.task))
    )
    return result.scalar_one()


async def update_block(
    block_id: str, data: CalendarBlockUpdate, session: AsyncSession
) -> Optional[CalendarBlock]:
    block = await get_block(block_id, session)
    if not block:
        return None

    new_date = data.scheduled_date or block.scheduled_date
    new_start = data.start_time or block.start_time
    new_end = data.end_time or block.end_time

    # Check overlap if time changed
    if data.scheduled_date or data.start_time or data.end_time:
        overlap = await _has_overlap(
            new_date, new_start, new_end, session, exclude_block_id=block_id
        )
        if overlap:
            raise ValueError("Time slot overlaps with an existing block")

    if data.scheduled_date is not None:
        block.scheduled_date = data.scheduled_date
    if data.start_time is not None:
        block.start_time = data.start_time
    if data.end_time is not None:
        block.end_time = data.end_time
    if data.is_locked is not None:
        block.is_locked = data.is_locked
    if data.status is not None:
        block.status = data.status
    if data.title is not None:
        block.title = data.title

    # Recalculate duration
    from datetime import datetime
    start_dt = datetime.combine(block.scheduled_date, block.start_time)
    end_dt = datetime.combine(block.scheduled_date, block.end_time)
    block.duration_minutes = int((end_dt - start_dt).total_seconds()) // 60

    # Track rescheduling on the task
    if (data.scheduled_date or data.start_time) and block.task:
        block.task.times_rescheduled += 1

    await session.commit()
    # Re-fetch with task relationship eagerly loaded
    return await get_block(block_id, session)


async def delete_block(block_id: str, session: AsyncSession) -> bool:
    block = await get_block(block_id, session)
    if not block:
        return False
    await session.delete(block)
    await session.commit()
    return True


async def toggle_lock(block_id: str, session: AsyncSession) -> Optional[CalendarBlock]:
    block = await get_block(block_id, session)
    if not block:
        return None
    block.is_locked = not block.is_locked
    if block.is_locked and block.status == BlockStatus.SCHEDULED:
        block.status = BlockStatus.CONFIRMED
    await session.commit()
    await session.refresh(block)
    return block


async def _has_overlap(
    scheduled_date: date,
    start_time: time,
    end_time: time,
    session: AsyncSession,
    exclude_block_id: Optional[str] = None,
) -> bool:
    conditions = [
        CalendarBlock.scheduled_date == scheduled_date,
        CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
        CalendarBlock.start_time < end_time,
        CalendarBlock.end_time > start_time,
    ]
    if exclude_block_id:
        conditions.append(CalendarBlock.id != exclude_block_id)

    result = await session.execute(
        select(CalendarBlock).where(and_(*conditions)).limit(1)
    )
    return result.scalar_one_or_none() is not None


# ─── Block Detail, Notes & Tags ──────────────────────────────────────────


async def get_block_detail(block_id: str, session: AsyncSession) -> Optional[CalendarBlock]:
    """Get block with notes and tagged tasks eagerly loaded."""
    result = await session.execute(
        select(CalendarBlock)
        .where(CalendarBlock.id == block_id)
        .options(
            selectinload(CalendarBlock.task),
            selectinload(CalendarBlock.notes),
            selectinload(CalendarBlock.tagged_tasks),
        )
    )
    return result.scalar_one_or_none()


async def add_note(
    block_id: str, content: str, session: AsyncSession, source: str = "user"
) -> Optional[BlockNote]:
    block = await get_block(block_id, session)
    if not block:
        return None
    note = BlockNote(block_id=block_id, content=content, source=source)
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def tag_task(block_id: str, task_id: str, session: AsyncSession) -> bool:
    block = await get_block(block_id, session)
    if not block:
        return False
    task = await session.get(Task, task_id)
    if not task:
        return False
    # Check if already tagged
    result = await session.execute(
        select(block_tagged_tasks).where(
            block_tagged_tasks.c.block_id == block_id,
            block_tagged_tasks.c.task_id == task_id,
        )
    )
    if result.first():
        return True  # Already tagged
    await session.execute(
        block_tagged_tasks.insert().values(block_id=block_id, task_id=task_id)
    )
    await session.commit()
    return True


async def untag_task(block_id: str, task_id: str, session: AsyncSession) -> bool:
    result = await session.execute(
        block_tagged_tasks.delete().where(
            block_tagged_tasks.c.block_id == block_id,
            block_tagged_tasks.c.task_id == task_id,
        )
    )
    await session.commit()
    return result.rowcount > 0
