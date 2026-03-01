from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_llm_adapter, get_session, get_settings
from app.config import Settings
from app.llm.base import LLMAdapter
from app.services.gatekeeper_orchestrator import handle_gatekeeper_stream

router = APIRouter(prefix="/gatekeeper", tags=["gatekeeper"])


class GatekeeperRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    site_name: str = "this site"


@router.post("/stream")
async def gatekeeper_stream(
    body: GatekeeperRequest,
    session: AsyncSession = Depends(get_session),
    llm: LLMAdapter = Depends(get_llm_adapter),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    return StreamingResponse(
        handle_gatekeeper_stream(
            message=body.message,
            session=session,
            llm=llm,
            session_id=body.session_id,
            timezone_str=settings.timezone,
            site_name=body.site_name,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
