"""CRUD and search for the Memory model."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory


async def create_memory(
    content: str, session: AsyncSession, category: Optional[str] = None
) -> Memory:
    mem = Memory(content=content, category=category)
    session.add(mem)
    await session.commit()
    await session.refresh(mem)
    return mem


async def get_active_memories(session: AsyncSession) -> list[Memory]:
    result = await session.execute(
        select(Memory)
        .where(Memory.is_active == True)  # noqa: E712
        .order_by(Memory.created_at)
    )
    return list(result.scalars().all())


async def list_memories(session: AsyncSession) -> list[Memory]:
    result = await session.execute(
        select(Memory).order_by(Memory.created_at.desc())
    )
    return list(result.scalars().all())


async def search_memories(query: str, session: AsyncSession) -> list[Memory]:
    pattern = f"%{query}%"
    result = await session.execute(
        select(Memory)
        .where(Memory.is_active == True, Memory.content.ilike(pattern))  # noqa: E712
        .order_by(Memory.created_at)
    )
    return list(result.scalars().all())


async def forget_memory(memory_id: str, session: AsyncSession) -> bool:
    """Soft-delete: mark as inactive."""
    mem = await session.get(Memory, memory_id)
    if not mem:
        return False
    mem.is_active = False
    await session.commit()
    return True


async def delete_memory(memory_id: str, session: AsyncSession) -> bool:
    """Hard delete."""
    mem = await session.get(Memory, memory_id)
    if not mem:
        return False
    await session.delete(mem)
    await session.commit()
    return True
