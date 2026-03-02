from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.linkedin_connection import LinkedInConnection
from app.schemas.linkedin_connection import LinkedInConnectionCreate, LinkedInConnectionUpdate


async def list_connections(
    session: AsyncSession, status: Optional[str] = None
) -> list[LinkedInConnection]:
    stmt = select(LinkedInConnection).order_by(LinkedInConnection.created_at.desc())
    if status:
        stmt = stmt.where(LinkedInConnection.status == status)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_connection(
    data: LinkedInConnectionCreate, session: AsyncSession
) -> LinkedInConnection:
    conn = LinkedInConnection(
        name=data.name,
        profile_url=data.profile_url,
        reason=data.reason,
    )
    session.add(conn)
    await session.commit()
    await session.refresh(conn)
    return conn


async def update_connection(
    connection_id: str, data: LinkedInConnectionUpdate, session: AsyncSession
) -> Optional[LinkedInConnection]:
    result = await session.execute(
        select(LinkedInConnection).where(LinkedInConnection.id == connection_id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return None
    if data.name is not None:
        conn.name = data.name
    if data.reason is not None:
        conn.reason = data.reason
    if data.status is not None:
        conn.status = data.status
    await session.commit()
    await session.refresh(conn)
    return conn


async def delete_connection(connection_id: str, session: AsyncSession) -> bool:
    result = await session.execute(
        select(LinkedInConnection).where(LinkedInConnection.id == connection_id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return False
    await session.delete(conn)
    await session.commit()
    return True


async def get_pending_connections(session: AsyncSession) -> list[LinkedInConnection]:
    result = await session.execute(
        select(LinkedInConnection).where(LinkedInConnection.status == "pending")
    )
    return list(result.scalars().all())
