from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_link import LinkType, SavedLink
from app.schemas.saved_link import SavedLinkCreate


async def list_links(
    session: AsyncSession,
    is_read: bool | None = None,
    link_type: str | None = None,
    limit: int = 50,
) -> list[SavedLink]:
    stmt = select(SavedLink).order_by(SavedLink.created_at.desc())
    if is_read is not None:
        stmt = stmt.where(SavedLink.is_read == is_read)
    if link_type:
        stmt = stmt.where(SavedLink.link_type == LinkType(link_type))
    stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_link(data: SavedLinkCreate, session: AsyncSession) -> SavedLink:
    link = SavedLink(
        url=data.url,
        title=data.title,
        description=data.description,
        link_type=LinkType(data.link_type),
    )
    session.add(link)
    await session.commit()
    await session.refresh(link)
    return link


async def mark_read(link_id: str, session: AsyncSession) -> SavedLink | None:
    result = await session.execute(
        select(SavedLink).where(SavedLink.id == link_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        return None
    link.is_read = True
    await session.commit()
    await session.refresh(link)
    return link


async def delete_link(link_id: str, session: AsyncSession) -> bool:
    result = await session.execute(
        select(SavedLink).where(SavedLink.id == link_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        return False
    await session.delete(link)
    await session.commit()
    return True


async def get_random_unread(
    session: AsyncSession, limit: int = 3
) -> list[SavedLink]:
    stmt = (
        select(SavedLink)
        .where(SavedLink.is_read == False)  # noqa: E712
        .order_by(func.random())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
