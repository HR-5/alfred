from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectTaskResponse, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(session: AsyncSession = Depends(get_session)):
    projects = await project_service.list_projects(session)
    result = []
    for p in projects:
        count = await project_service.get_task_count(p.id, session)
        result.append(ProjectResponse(
            id=p.id,
            title=p.title,
            description=p.description,
            notes=p.notes,
            color=p.color,
            created_at=p.created_at,
            task_count=count,
        ))
    return result


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, session: AsyncSession = Depends(get_session)):
    proj = await project_service.create_project(body, session)
    return ProjectResponse(
        id=proj.id,
        title=proj.title,
        description=proj.description,
        notes=proj.notes,
        color=proj.color,
        created_at=proj.created_at,
        task_count=0,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, session: AsyncSession = Depends(get_session)):
    proj = await project_service.get_project(project_id, session)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    count = await project_service.get_task_count(project_id, session)
    return ProjectResponse(
        id=proj.id,
        title=proj.title,
        description=proj.description,
        notes=proj.notes,
        color=proj.color,
        created_at=proj.created_at,
        task_count=count,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, body: ProjectUpdate, session: AsyncSession = Depends(get_session)
):
    proj = await project_service.update_project(project_id, body, session)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    count = await project_service.get_task_count(project_id, session)
    return ProjectResponse(
        id=proj.id,
        title=proj.title,
        description=proj.description,
        notes=proj.notes,
        color=proj.color,
        created_at=proj.created_at,
        task_count=count,
    )


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, session: AsyncSession = Depends(get_session)):
    deleted = await project_service.delete_project(project_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/tasks", response_model=list[ProjectTaskResponse])
async def get_project_tasks(project_id: str, session: AsyncSession = Depends(get_session)):
    tasks = await project_service.get_project_tasks(project_id, session)
    return [
        ProjectTaskResponse(
            id=t.id,
            title=t.title,
            status=t.status.value,
            priority=t.priority.value,
            due_date=t.due_date.isoformat() if t.due_date else None,
        )
        for t in tasks
    ]


@router.post("/{project_id}/tasks/{task_id}", status_code=204)
async def assign_task(
    project_id: str, task_id: str, session: AsyncSession = Depends(get_session)
):
    task = await project_service.assign_task_to_project(task_id, project_id, session)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
async def remove_task(
    project_id: str, task_id: str, session: AsyncSession = Depends(get_session)
):
    task = await project_service.assign_task_to_project(task_id, None, session)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
