from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.memory import MemoryResponse
from app.services import memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=list[MemoryResponse])
async def list_memories(session: AsyncSession = Depends(get_session)):
    return await memory_service.list_memories(session)


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(memory_id: str, session: AsyncSession = Depends(get_session)):
    deleted = await memory_service.delete_memory(memory_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
