from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[list[str]] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    due_before: Optional[date] = Query(default=None),
    due_after: Optional[date] = Query(default=None),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    session: AsyncSession = Depends(get_session),
) -> TaskListResponse:
    tasks, total = await task_service.list_tasks(
        session,
        status=status,
        priority=priority,
        category=category,
        due_before=due_before,
        due_after=due_after,
        search=q,
        limit=limit,
        offset=offset,
    )
    return TaskListResponse(
        tasks=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
    )


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    body: TaskCreate,
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await task_service.create_task(body, session)
    return TaskResponse.model_validate(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await task_service.get_task(task_id, session)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await task_service.update_task(task_id, body, session)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await task_service.delete_task(task_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await task_service.complete_task(task_id, session)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.post("/{task_id}/notes", status_code=201)
async def add_note(
    task_id: str,
    body: dict,
    session: AsyncSession = Depends(get_session),
) -> dict:
    note = await task_service.add_note(task_id, body.get("content", ""), session)
    if not note:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"id": note.id, "content": note.content, "created_at": note.created_at.isoformat()}
