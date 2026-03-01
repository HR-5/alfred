import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_llm_adapter, get_session, get_settings
from app.config import Settings
from app.llm.base import LLMAdapter
from app.models.conversation import ConversationLog
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_orchestrator import handle_message, handle_message_stream

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    session: AsyncSession = Depends(get_session),
    llm: LLMAdapter = Depends(get_llm_adapter),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    return await handle_message(
        message=body.message,
        session=session,
        llm=llm,
        session_id=body.session_id,
        timezone_str=settings.timezone,
    )


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    session: AsyncSession = Depends(get_session),
    llm: LLMAdapter = Depends(get_llm_adapter),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    return StreamingResponse(
        handle_message_stream(
            message=body.message,
            session=session,
            llm=llm,
            session_id=body.session_id,
            timezone_str=settings.timezone,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = Query(None),
    limit: int = Query(40, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return recent chat messages for a session, oldest first."""
    query = (
        select(ConversationLog)
        .order_by(desc(ConversationLog.created_at))
        .limit(limit)
    )
    if session_id:
        query = query.where(ConversationLog.session_id == session_id)
    result = await session.execute(query)
    logs = list(reversed(result.scalars().all()))
    return {
        "messages": [
            {
                "id": log.id,
                "role": log.role,
                "content": log.content,
                "timestamp": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "session_id": session_id,
    }
