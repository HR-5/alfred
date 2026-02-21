import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_llm_adapter, get_session, get_settings
from app.config import Settings
from app.llm.base import LLMAdapter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_orchestrator import handle_message

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
