from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blocked_site import BlockedSite
from app.schemas.blocked_site import BlockedSiteCreate


async def list_sites(session: AsyncSession) -> list[BlockedSite]:
    result = await session.execute(
        select(BlockedSite).order_by(BlockedSite.created_at)
    )
    return list(result.scalars().all())


async def create_site(data: BlockedSiteCreate, session: AsyncSession) -> BlockedSite:
    site = BlockedSite(name=data.name, pattern=data.pattern)
    session.add(site)
    await session.commit()
    await session.refresh(site)
    return site


async def delete_site(site_id: str, session: AsyncSession) -> bool:
    result = await session.execute(
        select(BlockedSite).where(BlockedSite.id == site_id)
    )
    site = result.scalar_one_or_none()
    if not site:
        return False
    await session.delete(site)
    await session.commit()
    return True
