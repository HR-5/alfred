"""CRUD for the Project model."""
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectUpdate


async def create_project(data: ProjectCreate, session: AsyncSession) -> Project:
    proj = Project(
        title=data.title,
        description=data.description,
        notes=data.notes,
        color=data.color,
    )
    session.add(proj)
    await session.commit()
    await session.refresh(proj)
    return proj


async def list_projects(session: AsyncSession) -> list[Project]:
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())


async def get_project(project_id: str, session: AsyncSession) -> Optional[Project]:
    return await session.get(Project, project_id)


async def update_project(
    project_id: str, data: ProjectUpdate, session: AsyncSession
) -> Optional[Project]:
    proj = await session.get(Project, project_id)
    if not proj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(proj, field, value)
    await session.commit()
    await session.refresh(proj)
    return proj


async def delete_project(project_id: str, session: AsyncSession) -> bool:
    proj = await session.get(Project, project_id)
    if not proj:
        return False
    await session.delete(proj)
    await session.commit()
    return True


async def get_project_tasks(project_id: str, session: AsyncSession) -> list[Task]:
    result = await session.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())


async def assign_task_to_project(
    task_id: str, project_id: Optional[str], session: AsyncSession
) -> Optional[Task]:
    task = await session.get(Task, task_id)
    if not task:
        return None
    task.project_id = project_id
    await session.commit()
    return task


async def get_task_count(project_id: str, session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project_id)
    )
    return result.scalar() or 0
