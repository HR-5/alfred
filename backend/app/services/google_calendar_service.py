"""Google Calendar two-way sync service."""

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.calendar_block import BlockStatus, CalendarBlock
from app.models.integration import GoogleCalendarAuth

logger = logging.getLogger(__name__)


# ─── OAuth ─────────────────────────────────────────────────────────────────


def get_auth_url(settings: Settings) -> str:
    """Return the Google OAuth consent URL."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri],
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar"],
        redirect_uri=settings.google_redirect_uri,
    )
    url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return url


async def handle_callback(
    code: str, session: AsyncSession, settings: Settings
) -> GoogleCalendarAuth:
    """Exchange OAuth code for tokens and store them."""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri],
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar"],
        redirect_uri=settings.google_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Upsert — only one row expected
    result = await session.execute(select(GoogleCalendarAuth).limit(1))
    auth = result.scalar_one_or_none()

    if auth:
        auth.access_token = creds.token
        auth.refresh_token = creds.refresh_token or auth.refresh_token
        auth.token_expiry = creds.expiry
    else:
        auth = GoogleCalendarAuth(
            access_token=creds.token,
            refresh_token=creds.refresh_token or "",
            token_expiry=creds.expiry,
            calendar_id=settings.google_calendar_id,
        )
        session.add(auth)

    await session.commit()
    await session.refresh(auth)
    return auth


async def get_credentials(session: AsyncSession, settings: Settings):
    """Load stored OAuth credentials, refreshing if expired."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    result = await session.execute(select(GoogleCalendarAuth).limit(1))
    auth = result.scalar_one_or_none()
    if not auth:
        return None

    creds = Credentials(
        token=auth.access_token,
        refresh_token=auth.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        auth.access_token = creds.token
        auth.token_expiry = creds.expiry
        await session.commit()

    return creds


async def disconnect(session: AsyncSession) -> bool:
    """Remove stored Google Calendar tokens."""
    result = await session.execute(select(GoogleCalendarAuth).limit(1))
    auth = result.scalar_one_or_none()
    if not auth:
        return False
    await session.delete(auth)
    await session.commit()
    return True


async def get_status(session: AsyncSession) -> dict[str, Any]:
    """Return connection status."""
    result = await session.execute(select(GoogleCalendarAuth).limit(1))
    auth = result.scalar_one_or_none()
    if not auth:
        return {"connected": False}
    return {
        "connected": True,
        "calendar_id": auth.calendar_id,
        "last_sync_at": auth.last_sync_at.isoformat() if auth.last_sync_at else None,
    }


# ─── Google API Helpers ────────────────────────────────────────────────────


def _build_service(credentials):
    """Build a Google Calendar API service."""
    from googleapiclient.discovery import build

    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def _priority_to_color(priority: str) -> Optional[str]:
    """Map Alfred priority to Google Calendar color ID."""
    mapping = {
        "critical": "11",  # red
        "high": "4",       # flamingo
        "medium": "6",     # tangerine
        "low": "2",        # sage
    }
    return mapping.get(priority)


# ─── Sync Logic ────────────────────────────────────────────────────────────


async def push_block_to_google(
    block: CalendarBlock, session: AsyncSession, settings: Settings
) -> Optional[str]:
    """Push a single Alfred block to Google Calendar. Returns Google event ID."""
    creds = await get_credentials(session, settings)
    if not creds:
        return None

    service = _build_service(creds)

    title = block.title or (block.task.title if block.task else "Alfred Task")
    start_dt = datetime.combine(block.scheduled_date, block.start_time)
    end_dt = datetime.combine(block.scheduled_date, block.end_time)
    tz = settings.timezone

    event_body: dict[str, Any] = {
        "summary": title,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz},
        "description": f"Managed by Alfred | Block ID: {block.id}",
    }

    if block.task:
        color = _priority_to_color(block.task.priority.value)
        if color:
            event_body["colorId"] = color

    if block.external_id:
        # Update existing event
        event = service.events().update(
            calendarId=settings.google_calendar_id,
            eventId=block.external_id,
            body=event_body,
        ).execute()
    else:
        # Create new event
        event = service.events().insert(
            calendarId=settings.google_calendar_id,
            body=event_body,
        ).execute()

    event_id = event["id"]
    block.external_id = event_id
    await session.commit()
    return event_id


async def pull_events_from_google(
    start_date: date,
    end_date: date,
    session: AsyncSession,
    settings: Settings,
) -> list[dict[str, Any]]:
    """Fetch events from Google Calendar for a date range."""
    creds = await get_credentials(session, settings)
    if not creds:
        return []

    service = _build_service(creds)
    tz = settings.timezone

    time_min = datetime.combine(start_date, time(0, 0)).isoformat() + "Z"
    time_max = datetime.combine(end_date + timedelta(days=1), time(0, 0)).isoformat() + "Z"

    events_result = service.events().list(
        calendarId=settings.google_calendar_id,
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    return events_result.get("items", [])


async def sync(
    session: AsyncSession, settings: Settings, days_ahead: int = 14
) -> dict[str, int]:
    """Full two-way sync. Returns summary counts."""
    creds = await get_credentials(session, settings)
    if not creds:
        return {"error": "Not connected to Google Calendar"}

    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days_ahead)

    pushed = 0
    pulled = 0
    updated = 0

    # ── Push: Alfred blocks → Google ──
    result = await session.execute(
        select(CalendarBlock)
        .where(
            CalendarBlock.source == "alfred",
            CalendarBlock.external_id.is_(None),
            CalendarBlock.scheduled_date >= today,
            CalendarBlock.scheduled_date <= end_date,
            CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
        )
        .options(selectinload(CalendarBlock.task))
    )
    unpushed_blocks = list(result.scalars().all())

    for block in unpushed_blocks:
        try:
            event_id = await push_block_to_google(block, session, settings)
            if event_id:
                pushed += 1
        except Exception as exc:
            logger.warning("Failed to push block %s: %s", block.id, exc)

    # ── Pull: Google → Alfred blocks ──
    google_events = await pull_events_from_google(today, end_date, session, settings)
    google_event_ids = {event.get("id", "") for event in google_events}

    # Get all existing google_calendar blocks in the sync range
    result = await session.execute(
        select(CalendarBlock).where(
            CalendarBlock.source == "google_calendar",
            CalendarBlock.external_id.isnot(None),
            CalendarBlock.scheduled_date >= today,
            CalendarBlock.scheduled_date <= end_date,
        )
    )
    existing_gcal_blocks = list(result.scalars().all())
    existing_external_ids = {b.external_id for b in existing_gcal_blocks}

    # ── Delete: remove blocks whose Google events no longer exist ──
    deleted = 0
    for block in existing_gcal_blocks:
        if block.external_id not in google_event_ids:
            await session.delete(block)
            deleted += 1

    # ── Update existing + create new ──
    for event in google_events:
        event_id = event.get("id", "")

        # Skip Alfred-managed events (they have our description tag)
        desc = event.get("description", "")
        if "Managed by Alfred" in desc:
            continue

        # Parse event times
        start_info = event.get("start", {})
        end_info = event.get("end", {})

        # Skip all-day events
        if "date" in start_info and "dateTime" not in start_info:
            continue

        try:
            start_str = start_info.get("dateTime", "")
            end_str = end_info.get("dateTime", "")
            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)
            duration = int((end_dt - start_dt).total_seconds()) // 60

            if event_id in existing_external_ids:
                # Update existing block with latest Google data
                existing = next(
                    (b for b in existing_gcal_blocks if b.external_id == event_id), None
                )
                if existing:
                    existing.title = event.get("summary", "Google Event")
                    existing.scheduled_date = start_dt.date()
                    existing.start_time = start_dt.time()
                    existing.end_time = end_dt.time()
                    existing.duration_minutes = duration
                    updated += 1
            else:
                # Create new block
                block = CalendarBlock(
                    task_id=None,
                    scheduled_date=start_dt.date(),
                    start_time=start_dt.time(),
                    end_time=end_dt.time(),
                    duration_minutes=duration,
                    status=BlockStatus.CONFIRMED,
                    is_locked=True,
                    source="google_calendar",
                    external_id=event_id,
                    title=event.get("summary", "Google Event"),
                )
                session.add(block)
                pulled += 1
        except Exception as exc:
            logger.warning("Failed to pull event %s: %s", event_id, exc)

    # Update last_sync_at
    result = await session.execute(select(GoogleCalendarAuth).limit(1))
    auth = result.scalar_one_or_none()
    if auth:
        auth.last_sync_at = datetime.now(timezone.utc)

    await session.commit()

    return {"pushed": pushed, "pulled": pulled, "updated": updated, "deleted": deleted}


async def delete_google_event(
    external_id: str, session: AsyncSession, settings: Settings
) -> bool:
    """Delete an event from Google Calendar."""
    creds = await get_credentials(session, settings)
    if not creds:
        return False

    try:
        service = _build_service(creds)
        service.events().delete(
            calendarId=settings.google_calendar_id,
            eventId=external_id,
        ).execute()
        return True
    except Exception as exc:
        logger.warning("Failed to delete Google event %s: %s", external_id, exc)
        return False
