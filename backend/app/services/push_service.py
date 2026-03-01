"""Push notification service: VAPID key management + Web Push sender + reminder loop."""
import asyncio
import json
import logging
import os
from datetime import datetime, time as time_type, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

_VAPID_FILE = "./data/vapid_keys.json"


def _get_or_create_vapid_keys() -> dict:
    """Load VAPID keys from file, generating them on first call."""
    if os.path.exists(_VAPID_FILE):
        with open(_VAPID_FILE) as f:
            return json.load(f)

    try:
        from py_vapid import Vapid
        from cryptography.hazmat.primitives.serialization import (
            Encoding, PublicFormat, PrivateFormat, NoEncryption
        )
        import base64

        vapid = Vapid()
        vapid.generate_keys()

        # Use TraditionalOpenSSL (BEGIN EC PRIVATE KEY) — pywebpush can't parse PKCS8
        private_key = vapid.private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=NoEncryption(),
        ).decode("utf-8")
        public_key = base64.urlsafe_b64encode(
            vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        ).rstrip(b"=").decode("utf-8")

        keys = {"private_key": private_key, "public_key": public_key}
        os.makedirs(os.path.dirname(_VAPID_FILE), exist_ok=True)
        with open(_VAPID_FILE, "w") as f:
            json.dump(keys, f)
        logger.info("Generated new VAPID keys → %s", _VAPID_FILE)
        return keys
    except ImportError:
        logger.warning("pywebpush not installed; push notifications disabled")
        return {}


def get_vapid_public_key() -> Optional[str]:
    keys = _get_or_create_vapid_keys()
    return keys.get("public_key")


async def save_subscription(
    endpoint: str, p256dh: str, auth: str, session: AsyncSession
) -> PushSubscription:
    result = await session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    sub = result.scalars().first()
    if sub:
        sub.p256dh = p256dh
        sub.auth = auth
    else:
        sub = PushSubscription(endpoint=endpoint, p256dh=p256dh, auth=auth)
        session.add(sub)
    await session.commit()
    return sub


async def remove_subscription(endpoint: str, session: AsyncSession) -> bool:
    result = await session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    sub = result.scalars().first()
    if not sub:
        return False
    await session.delete(sub)
    await session.commit()
    return True


async def get_all_subscriptions(session: AsyncSession) -> list[PushSubscription]:
    result = await session.execute(select(PushSubscription))
    return list(result.scalars().all())


async def clear_all_subscriptions(session: AsyncSession) -> None:
    """Delete all stored subscriptions — used for reset/debug."""
    subs = await get_all_subscriptions(session)
    for sub in subs:
        await session.delete(sub)
    await session.commit()


def _send_push_sync(
    subscription_info: dict, title: str, body: str, private_key_pem: str
) -> str:
    """Synchronous web push. Returns 'ok', 'gone', or 'error'."""
    try:
        from pywebpush import webpush, WebPushException
        from py_vapid import Vapid

        vapid = Vapid.from_pem(private_key_pem.encode())
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": body}),
            vapid_private_key=vapid,
            vapid_claims={"sub": "mailto:alfred@localhost"},
            content_encoding="aes128gcm",
        )
        return "ok"
    except Exception as exc:
        # Check for expired/unsubscribed (410 Gone) via response status code
        response = getattr(exc, "response", None)
        if response is not None:
            status = getattr(response, "status_code", None) or getattr(response, "status", None)
            if status == 410:
                logger.info("Push subscription gone (410) — will remove from DB")
                return "gone"
        # Fallback: check string representation
        exc_str = str(exc)
        if "410" in exc_str or "Gone" in exc_str or "unsubscribed" in exc_str:
            logger.info("Push subscription gone (410) — will remove from DB")
            return "gone"
        logger.warning("Push send failed: %s", exc)
        return "error"


async def send_push(
    sub: PushSubscription, title: str, body: str, session: AsyncSession | None = None
) -> bool:
    keys = _get_or_create_vapid_keys()
    if not keys:
        return False
    subscription_info = {
        "endpoint": sub.endpoint,
        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
    }
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _send_push_sync, subscription_info, title, body, keys["private_key"]
    )
    if result == "gone" and session:
        # Subscription is expired — remove it so it doesn't keep failing
        logger.info("Removing stale push subscription: %s…", sub.endpoint[:60])
        await session.delete(sub)
        await session.commit()
    return result == "ok"


async def reminder_loop(session_factory, tz_str: str, lead_min: int) -> None:
    """Background task: sends push notifications for upcoming calendar blocks."""
    from app.models.calendar_block import CalendarBlock

    tz = ZoneInfo(tz_str)
    notified: set[str] = set()

    while True:
        await asyncio.sleep(60)
        try:
            async with session_factory() as session:
                subs = await get_all_subscriptions(session)
                if not subs:
                    continue

                now = datetime.now(tz)
                window_start = now + timedelta(minutes=lead_min - 1)
                window_end = now + timedelta(minutes=lead_min + 1)

                # Only handle same-day window (skip midnight boundary edge case)
                if window_start.date() != window_end.date():
                    continue

                target_date = window_start.date()
                ws_time = time_type(window_start.hour, window_start.minute)
                we_time = time_type(window_end.hour, window_end.minute)

                result = await session.execute(
                    select(CalendarBlock.id, CalendarBlock.title, CalendarBlock.start_time, CalendarBlock.end_time)
                    .where(
                        CalendarBlock.scheduled_date == target_date,
                        CalendarBlock.start_time.between(ws_time, we_time),
                        CalendarBlock.status.in_(["scheduled", "confirmed"]),
                    )
                )
                rows = result.all()

                for row in rows:
                    if row.id in notified:
                        continue
                    display_title = row.title or "Upcoming event"
                    start_str = row.start_time.strftime("%H:%M") if hasattr(row.start_time, "strftime") else str(row.start_time)
                    end_str = row.end_time.strftime("%H:%M") if hasattr(row.end_time, "strftime") else str(row.end_time)
                    for sub in subs:
                        await send_push(
                            sub,
                            f"Starting in {lead_min} min: {display_title}",
                            f"{start_str} – {end_str}",
                            session=session,
                        )
                    notified.add(row.id)
        except Exception as exc:
            logger.error("Reminder loop error: %s", exc)
