"""Google Calendar integration API endpoints."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_settings
from app.config import Settings
from app.services import google_calendar_service as gcal

router = APIRouter(prefix="/integrations/google", tags=["integrations"])


@router.get("/connect")
async def connect(settings: Settings = Depends(get_settings)):
    """Return the Google OAuth consent URL."""
    url = gcal.get_auth_url(settings)
    return {"auth_url": url}


@router.get("/callback")
async def callback(
    code: str,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    """OAuth callback — exchange code for tokens."""
    auth = await gcal.handle_callback(code, session, settings)
    return {"connected": True, "calendar_id": auth.calendar_id}


@router.post("/disconnect")
async def disconnect(session: AsyncSession = Depends(get_session)):
    """Remove stored Google Calendar tokens."""
    removed = await gcal.disconnect(session)
    return {"disconnected": removed}


@router.get("/status")
async def status(session: AsyncSession = Depends(get_session)):
    """Check connection status."""
    return await gcal.get_status(session)


@router.post("/sync")
async def sync(
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    """Trigger a manual full sync."""
    result = await gcal.sync(session, settings)
    return result
