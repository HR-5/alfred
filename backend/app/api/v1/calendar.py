from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_settings
from app.config import Settings
from app.schemas.calendar import (
    BlockDetailResponse,
    BlockNoteCreate,
    BlockNoteResponse,
    BlockTagRequest,
    CalendarBlockCreate,
    CalendarBlockResponse,
    CalendarBlockUpdate,
    TaggedTaskSummary,
    WeekScheduleRequest,
    WeekScheduleResponse,
)
from app.services import calendar_service
from app.services.scheduler import schedule_week

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _block_to_response(block) -> CalendarBlockResponse:
    task = block.task
    return CalendarBlockResponse(
        id=block.id,
        task_id=block.task_id,
        scheduled_date=block.scheduled_date,
        start_time=block.start_time,
        end_time=block.end_time,
        duration_minutes=block.duration_minutes,
        status=block.status,
        is_locked=block.is_locked,
        source=block.source,
        title=block.title,
        task_title=block.title or (task.title if task else "Untitled"),
        task_priority=task.priority.value if task else "none",
        task_energy_level=task.energy_level.value if task and task.energy_level else None,
        task_status=task.status.value if task else "todo",
    )


def _block_to_detail(block) -> BlockDetailResponse:
    base = _block_to_response(block)
    notes = [
        BlockNoteResponse(
            id=n.id,
            content=n.content,
            source=n.source,
            created_at=n.created_at,
        )
        for n in getattr(block, "notes", [])
    ]
    tagged = [
        TaggedTaskSummary(
            id=t.id,
            title=t.title,
            status=t.status.value,
            priority=t.priority.value,
        )
        for t in getattr(block, "tagged_tasks", [])
    ]
    return BlockDetailResponse(
        **base.model_dump(),
        notes=notes,
        tagged_tasks=tagged,
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
    settings: Settings = Depends(get_settings),
) -> None:
    # If the block has an external Google event, delete it from Google first
    block = await calendar_service.get_block(block_id, session)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    if block.external_id:
        from app.services import google_calendar_service
        await google_calendar_service.delete_google_event(block.external_id, session, settings)
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


@router.get("/blocks/{block_id}", response_model=BlockDetailResponse)
async def get_block_detail(
    block_id: str,
    session: AsyncSession = Depends(get_session),
) -> BlockDetailResponse:
    block = await calendar_service.get_block_detail(block_id, session)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return _block_to_detail(block)


@router.post("/blocks/{block_id}/notes", response_model=BlockNoteResponse, status_code=201)
async def add_block_note(
    block_id: str,
    body: BlockNoteCreate,
    session: AsyncSession = Depends(get_session),
) -> BlockNoteResponse:
    note = await calendar_service.add_note(block_id, body.content, session)
    if not note:
        raise HTTPException(status_code=404, detail="Block not found")
    return BlockNoteResponse(
        id=note.id, content=note.content, source=note.source, created_at=note.created_at,
    )


@router.post("/blocks/{block_id}/tag", status_code=201)
async def tag_task(
    block_id: str,
    body: BlockTagRequest,
    session: AsyncSession = Depends(get_session),
):
    ok = await calendar_service.tag_task(block_id, body.task_id, session)
    if not ok:
        raise HTTPException(status_code=404, detail="Block or task not found")
    return {"tagged": True}


@router.delete("/blocks/{block_id}/tag/{task_id}", status_code=204)
async def untag_task(
    block_id: str,
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    removed = await calendar_service.untag_task(block_id, task_id, session)
    if not removed:
        raise HTTPException(status_code=404, detail="Tag not found")
