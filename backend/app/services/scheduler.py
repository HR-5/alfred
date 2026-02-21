"""
Deterministic task scheduling engine.

Takes unscheduled tasks and assigns them to optimal time blocks on the calendar
based on priority, deadline urgency, energy levels, and working hours.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.calendar_block import BlockStatus, CalendarBlock
from app.models.task import EnergyLevel, Priority, Task, TaskStatus

# --- Constants ---

PRIORITY_ORDER = {
    Priority.CRITICAL: 0,
    Priority.HIGH: 1,
    Priority.MEDIUM: 2,
    Priority.LOW: 3,
    Priority.NONE: 4,
}

MAX_BLOCK_MINUTES = 120
MIN_BLOCK_MINUTES = 15
SLOT_GRANULARITY = 15


# --- Data structures ---

@dataclass
class TimeSlot:
    date: date
    start: time
    end: time

    @property
    def duration_minutes(self) -> int:
        start_dt = datetime.combine(self.date, self.start)
        end_dt = datetime.combine(self.date, self.end)
        return int((end_dt - start_dt).total_seconds()) // 60


# --- Main entry point ---

async def schedule_week(
    week_start: date,
    session: AsyncSession,
    settings: Settings,
    force_reschedule: bool = False,
) -> dict:
    """
    Schedule all eligible tasks into the given week.

    Returns dict with blocks, counts, and unschedulable task IDs.
    """
    week_end = week_start + timedelta(days=6)

    # Step 1: Clear non-locked blocks if forced
    if force_reschedule:
        await _clear_unlocked_blocks(week_start, week_end, session)

    # Step 2: Load existing blocks for the week
    existing_blocks = await _get_existing_blocks(week_start, week_end, session)

    # Step 3: Build occupied time map
    occupied = _build_occupied_map(existing_blocks, week_start, week_end)

    # Step 4: Load schedulable tasks
    tasks = await _get_schedulable_tasks(session)

    # Step 5: Calculate remaining minutes needed per task
    task_needs: list[tuple[Task, int]] = []
    for task in tasks:
        estimated = task.estimated_minutes or settings.default_task_duration_min
        already_scheduled = sum(
            b.duration_minutes
            for b in task.calendar_blocks
            if b.status in (BlockStatus.SCHEDULED, BlockStatus.CONFIRMED)
            and week_start <= b.scheduled_date <= week_end
        )
        remaining = estimated - already_scheduled
        if remaining > 0:
            task_needs.append((task, remaining))

    # Step 6: Sort by priority, deadline urgency, energy
    task_needs.sort(key=lambda pair: _scheduling_sort_key(pair[0]))

    # Step 7: Greedy slot assignment
    new_blocks: list[CalendarBlock] = []
    unschedulable: list[str] = []

    work_start = _parse_time(settings.default_work_start)
    work_end = _parse_time(settings.default_work_end)

    for task, remaining_minutes in task_needs:
        minutes_left = remaining_minutes
        task_scheduled = False

        while minutes_left > 0:
            block_size = min(minutes_left, MAX_BLOCK_MINUTES)
            if block_size < MIN_BLOCK_MINUTES:
                block_size = MIN_BLOCK_MINUTES

            slot = _find_best_slot(
                task=task,
                duration=block_size,
                week_start=week_start,
                week_end=week_end,
                work_start=work_start,
                work_end=work_end,
                occupied=occupied,
            )

            if slot is None:
                if not task_scheduled:
                    unschedulable.append(task.id)
                break

            block = CalendarBlock(
                task_id=task.id,
                scheduled_date=slot.date,
                start_time=slot.start,
                end_time=slot.end,
                duration_minutes=slot.duration_minutes,
                status=BlockStatus.SCHEDULED,
                is_locked=False,
            )
            new_blocks.append(block)
            session.add(block)
            _mark_occupied(occupied, slot)
            minutes_left -= slot.duration_minutes
            task_scheduled = True

    await session.commit()

    # Reload all blocks for the response
    all_blocks = await _get_existing_blocks(week_start, week_end, session)

    return {
        "blocks": all_blocks,
        "tasks_scheduled": len(task_needs) - len(set(unschedulable)),
        "tasks_unschedulable": len(set(unschedulable)),
        "unschedulable_task_ids": list(set(unschedulable)),
    }


# --- Sorting ---

def _scheduling_sort_key(task: Task) -> tuple:
    """Lower tuple = scheduled first."""
    priority_rank = PRIORITY_ORDER.get(task.priority, 4)

    if task.due_date:
        days_until_due = (task.due_date - date.today()).days
    else:
        days_until_due = 999

    energy_rank = {
        EnergyLevel.HIGH: 0,
        EnergyLevel.MEDIUM: 1,
        EnergyLevel.LOW: 2,
    }.get(task.energy_level, 1)

    return (priority_rank, days_until_due, energy_rank)


# --- Slot finding ---

def _find_best_slot(
    task: Task,
    duration: int,
    week_start: date,
    week_end: date,
    work_start: time,
    work_end: time,
    occupied: dict[date, list[tuple[time, time]]],
) -> Optional[TimeSlot]:
    """Find the best available slot for a task, energy-aware."""
    today = date.today()
    scan_start = max(week_start, today)

    morning_end = _add_hours(work_start, 3)
    afternoon_start = time(14, 0)

    if task.energy_level == EnergyLevel.HIGH:
        preferred = [(work_start, morning_end)]
        fallback = [(morning_end, work_end)]
    elif task.energy_level == EnergyLevel.LOW:
        preferred = [(afternoon_start, work_end)]
        fallback = [(work_start, afternoon_start)]
    else:
        preferred = [(work_start, work_end)]
        fallback = []

    for windows in [preferred, fallback]:
        current_date = scan_start
        while current_date <= week_end:
            for win_start, win_end in windows:
                slot = _scan_window(current_date, win_start, win_end, duration, occupied)
                if slot:
                    return slot
            current_date += timedelta(days=1)

    return None


def _scan_window(
    day: date,
    window_start: time,
    window_end: time,
    duration: int,
    occupied: dict[date, list[tuple[time, time]]],
) -> Optional[TimeSlot]:
    """Scan a time window for a free contiguous slot."""
    cursor = datetime.combine(day, window_start)
    window_end_dt = datetime.combine(day, window_end)

    while cursor + timedelta(minutes=duration) <= window_end_dt:
        candidate_end = cursor + timedelta(minutes=duration)
        slot = TimeSlot(date=day, start=cursor.time(), end=candidate_end.time())
        if not _overlaps_occupied(slot, occupied):
            return slot
        cursor += timedelta(minutes=SLOT_GRANULARITY)

    return None


# --- Occupied time tracking ---

def _build_occupied_map(
    blocks: list[CalendarBlock],
    week_start: date,
    week_end: date,
) -> dict[date, list[tuple[time, time]]]:
    occupied: dict[date, list[tuple[time, time]]] = {}
    current = week_start
    while current <= week_end:
        occupied[current] = []
        current += timedelta(days=1)

    for block in blocks:
        if block.scheduled_date in occupied:
            occupied[block.scheduled_date].append(
                (block.start_time, block.end_time)
            )
    return occupied


def _overlaps_occupied(
    slot: TimeSlot,
    occupied: dict[date, list[tuple[time, time]]],
) -> bool:
    day_intervals = occupied.get(slot.date, [])
    for occ_start, occ_end in day_intervals:
        if slot.start < occ_end and slot.end > occ_start:
            return True
    return False


def _mark_occupied(occupied: dict[date, list[tuple[time, time]]], slot: TimeSlot) -> None:
    if slot.date not in occupied:
        occupied[slot.date] = []
    occupied[slot.date].append((slot.start, slot.end))


# --- DB helpers ---

async def _get_schedulable_tasks(session: AsyncSession) -> list[Task]:
    result = await session.execute(
        select(Task)
        .where(Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]))
        .options(selectinload(Task.calendar_blocks))
    )
    return list(result.scalars().all())


async def _get_existing_blocks(
    week_start: date,
    week_end: date,
    session: AsyncSession,
) -> list[CalendarBlock]:
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


async def _clear_unlocked_blocks(
    week_start: date,
    week_end: date,
    session: AsyncSession,
) -> None:
    result = await session.execute(
        select(CalendarBlock).where(
            and_(
                CalendarBlock.scheduled_date >= week_start,
                CalendarBlock.scheduled_date <= week_end,
                CalendarBlock.is_locked == False,  # noqa: E712
                CalendarBlock.status == BlockStatus.SCHEDULED,
            )
        )
    )
    for block in result.scalars().all():
        await session.delete(block)
    await session.flush()


# --- Utilities ---

def _parse_time(time_str: str) -> time:
    parts = time_str.split(":")
    return time(int(parts[0]), int(parts[1]))


def _add_hours(t: time, hours: int) -> time:
    dt = datetime.combine(date.today(), t) + timedelta(hours=hours)
    return dt.time()
