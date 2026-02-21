from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_settings
from app.config import Settings
from app.schemas.calendar import (
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    WeekScheduleRequest,
    WeekScheduleResponse,
)
from app.services import calendar_service
from app.services.scheduler import schedule_week

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _block_to_response(block) -> CalendarBlockResponse:
    return CalendarBlockResponse(
        id=block.id,
        task_id=block.task_id,
        scheduled_date=block.scheduled_date,
        start_time=block.start_time,
        end_time=block.end_time,
        duration_minutes=block.duration_minutes,
        status=block.status,
        is_locked=block.is_locked,
        task_title=block.task.title,
        task_priority=block.task.priority.value,
        task_energy_level=block.task.energy_level.value if block.task.energy_level else None,
        task_status=block.task.status.value,
    )


@router.get("/blocks", response_model=WeekScheduleResponse)
async def get_week_blocks(
    week_start: date = Query(..., description="Monday of the week (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
) -> WeekScheduleResponse:
    blocks = await calendar_service.get_week_blocks(week_start, session)
    return WeekScheduleResponse(
        blocks=[_block_to_response(b) for b in blocks],
        week_start=week_start,
        week_end=week_start + timedelta(days=6),
        tasks_scheduled=len({b.task_id for b in blocks}),
        tasks_unschedulable=0,
        unschedulable_task_ids=[],
    )


@router.post("/schedule", response_model=WeekScheduleResponse)
async def trigger_schedule(
    body: WeekScheduleRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> WeekScheduleResponse:
    result = await schedule_week(
        week_start=body.week_start,
        session=session,
        settings=settings,
        force_reschedule=body.force_reschedule,
    )
    return WeekScheduleResponse(
        blocks=[_block_to_response(b) for b in result["blocks"]],
        week_start=body.week_start,
        week_end=body.week_start + timedelta(days=6),
        tasks_scheduled=result["tasks_scheduled"],
        tasks_unschedulable=result["tasks_unschedulable"],
        unschedulable_task_ids=result["unschedulable_task_ids"],
    )


@router.post("/blocks", response_model=CalendarBlockResponse, status_code=201)
async def create_block(
    body: CalendarBlockCreate,
    session: AsyncSession = Depends(get_session),
) -> CalendarBlockResponse:
    try:
        block = await calendar_service.create_block(body, session)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _block_to_response(block)


@router.put("/blocks/{block_id}", response_model=CalendarBlockResponse)
async def update_block(
    block_id: str,
    body: CalendarBlockUpdate,
    session: AsyncSession = Depends(get_session),
) -> CalendarBlockResponse:
    try:
        block = await calendar_service.update_block(block_id, body, session)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return _block_to_response(block)


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(
    block_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await calendar_service.delete_block(block_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Block not found")


@router.post("/blocks/{block_id}/lock", response_model=CalendarBlockResponse)
async def toggle_lock(
    block_id: str,
    session: AsyncSession = Depends(get_session),
) -> CalendarBlockResponse:
    block = await calendar_service.toggle_lock(block_id, session)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return _block_to_response(block)
