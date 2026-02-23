"""Telegram bot service — full agentic Alfred via Telegram with proactive notifications."""

import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.llm.base import LLMAdapter
from app.models.calendar_block import BlockStatus, CalendarBlock
from app.models.task import Task, TaskStatus

logger = logging.getLogger(__name__)

_bot = None
_polling_task: Optional[asyncio.Task] = None
_notification_task: Optional[asyncio.Task] = None
_settings: Optional[Settings] = None
_session_factory = None
_llm: Optional[LLMAdapter] = None
_chat_id: Optional[int] = None  # Auto-captured from first message


async def init_bot(settings: Settings) -> bool:
    """Initialize the Telegram bot. Returns True if successful."""
    global _bot, _settings, _chat_id
    if not settings.telegram_bot_token:
        return False

    try:
        from telegram import Bot

        _bot = Bot(token=settings.telegram_bot_token)
        _settings = settings
        if settings.telegram_chat_id:
            _chat_id = int(settings.telegram_chat_id)
        me = await _bot.get_me()
        logger.info("Telegram bot initialized: @%s", me.username)
        return True
    except Exception as exc:
        logger.error("Failed to init Telegram bot: %s", exc)
        return False


async def setup_webhook(settings: Settings) -> bool:
    """Register webhook URL with Telegram."""
    if not _bot or not settings.telegram_webhook_url:
        return False

    try:
        webhook_url = f"{settings.telegram_webhook_url}/api/v1/telegram/webhook"
        await _bot.set_webhook(url=webhook_url)
        logger.info("Telegram webhook set: %s", webhook_url)
        return True
    except Exception as exc:
        logger.error("Failed to set Telegram webhook: %s", exc)
        return False


async def start_polling(session_factory, llm: LLMAdapter):
    """Start polling for updates and notification scheduler."""
    global _polling_task, _notification_task, _session_factory, _llm
    _session_factory = session_factory
    _llm = llm
    _polling_task = asyncio.create_task(_poll_loop())
    _notification_task = asyncio.create_task(_notification_loop())
    logger.info("Telegram polling and notifications started")


async def _poll_loop():
    """Long-poll Telegram for updates."""
    offset = 0
    while True:
        try:
            updates = await _bot.get_updates(offset=offset, timeout=30)
            for update in updates:
                offset = update.update_id + 1
                if update.message and update.message.text:
                    asyncio.create_task(
                        _process_update(update.message.chat_id, update.message.text)
                    )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Telegram polling error: %s", exc)
            await asyncio.sleep(5)


async def _process_update(chat_id: int, text: str):
    """Process a single update with its own DB session."""
    global _chat_id

    # Auto-capture chat_id for proactive notifications
    if _chat_id is None:
        _chat_id = chat_id
        logger.info("Telegram chat_id captured: %s", chat_id)

    if text.strip() == "/start":
        try:
            await _bot.send_message(
                chat_id=chat_id,
                text="Good evening, sir. I'm Alfred, your personal task assistant. "
                     "I'll also send you proactive reminders about upcoming tasks and check-ins. "
                     "How may I help you today?",
            )
        except Exception:
            pass
        return

    async with _session_factory() as session:
        await handle_telegram_message(
            chat_id=chat_id,
            text=text,
            session=session,
            llm=_llm,
            settings=_settings,
        )


# ─── Proactive Notification Loop ──────────────────────────────────────────


async def _notification_loop():
    """Periodic notification scheduler — checks every minute."""
    # Track what we've already notified to avoid duplicates
    notified_blocks: set[str] = set()
    last_morning_date: Optional[str] = None
    last_checkin_hour: Optional[int] = None

    while True:
        try:
            await asyncio.sleep(60)  # Check every minute

            if not _chat_id or not _session_factory or not _settings:
                continue

            tz = ZoneInfo(_settings.timezone)
            now = datetime.now(tz)
            today = now.date()
            current_time = now.time()

            # ── Morning briefing (at wake time) ──
            wake_h, wake_m = map(int, _settings.default_wake_time.split(":"))
            wake_time = time(wake_h, wake_m)
            today_str = today.isoformat()

            if (
                last_morning_date != today_str
                and wake_time <= current_time <= time(wake_h, wake_m + 30 if wake_m + 30 < 60 else 59)
            ):
                last_morning_date = today_str
                await _send_morning_briefing(today)

            # ── Upcoming block reminders (N minutes before) ──
            lead_minutes = _settings.reminder_lead_time_min
            async with _session_factory() as session:
                result = await session.execute(
                    select(CalendarBlock)
                    .where(
                        CalendarBlock.scheduled_date == today,
                        CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
                    )
                    .options(selectinload(CalendarBlock.task))
                )
                blocks = list(result.scalars().all())

            for block in blocks:
                block_key = f"{block.id}:{today_str}"
                if block_key in notified_blocks:
                    continue

                block_start = datetime.combine(today, block.start_time).replace(tzinfo=tz)
                time_until = (block_start - now).total_seconds() / 60

                if 0 < time_until <= lead_minutes:
                    title = block.title or (block.task.title if block.task else "Task")
                    start_str = block.start_time.strftime("%H:%M")
                    mins_left = int(time_until)
                    msg = f"⏰ Reminder: \"{title}\" starts in {mins_left} minute{'s' if mins_left != 1 else ''} (at {start_str})"
                    await _send_notification(msg)
                    notified_blocks.add(block_key)

            # ── Periodic check-in (every 2 hours during work hours) ──
            work_start_h = int(_settings.default_work_start.split(":")[0])
            work_end_h = int(_settings.default_work_end.split(":")[0])
            checkin_hour = now.hour

            if (
                work_start_h < checkin_hour < work_end_h
                and checkin_hour % 2 == 0
                and last_checkin_hour != checkin_hour
                and now.minute < 5  # Only in the first 5 minutes of the hour
            ):
                last_checkin_hour = checkin_hour
                await _send_checkin(today, now)

            # Clean old notified blocks (keep set from growing)
            if len(notified_blocks) > 200:
                notified_blocks.clear()

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Notification loop error: %s", exc)
            await asyncio.sleep(60)


async def _send_morning_briefing(today):
    """Send a morning summary of today's schedule and pending tasks."""
    try:
        async with _session_factory() as session:
            # Today's blocks
            result = await session.execute(
                select(CalendarBlock)
                .where(
                    CalendarBlock.scheduled_date == today,
                    CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
                )
                .options(selectinload(CalendarBlock.task))
                .order_by(CalendarBlock.start_time)
            )
            blocks = list(result.scalars().all())

            # Overdue / due-today tasks
            result = await session.execute(
                select(Task).where(
                    Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
                    Task.due_date <= today,
                )
            )
            due_tasks = list(result.scalars().all())

        lines = ["☀️ Good morning, sir. Here's your day:\n"]

        if blocks:
            lines.append("📅 Today's schedule:")
            for b in blocks:
                title = b.title or (b.task.title if b.task else "Task")
                start = b.start_time.strftime("%H:%M")
                end = b.end_time.strftime("%H:%M")
                lines.append(f"  • {start}–{end}: {title}")
        else:
            lines.append("📅 No scheduled blocks today.")

        if due_tasks:
            overdue = [t for t in due_tasks if t.due_date < today]
            due_today = [t for t in due_tasks if t.due_date == today]

            if overdue:
                lines.append(f"\n⚠️ {len(overdue)} overdue task{'s' if len(overdue) != 1 else ''}:")
                for t in overdue[:5]:
                    lines.append(f"  • {t.title} (due {t.due_date.isoformat()})")

            if due_today:
                lines.append(f"\n📌 {len(due_today)} task{'s' if len(due_today) != 1 else ''} due today:")
                for t in due_today[:5]:
                    lines.append(f"  • {t.title}")

        lines.append("\nReply here to manage tasks or ask me anything.")
        await _send_notification("\n".join(lines))

    except Exception as exc:
        logger.error("Morning briefing error: %s", exc)


async def _send_checkin(today, now):
    """Send a brief check-in about current/next block."""
    try:
        tz = ZoneInfo(_settings.timezone)
        async with _session_factory() as session:
            result = await session.execute(
                select(CalendarBlock)
                .where(
                    CalendarBlock.scheduled_date == today,
                    CalendarBlock.status.in_([BlockStatus.SCHEDULED, BlockStatus.CONFIRMED]),
                )
                .options(selectinload(CalendarBlock.task))
                .order_by(CalendarBlock.start_time)
            )
            blocks = list(result.scalars().all())

        if not blocks:
            return  # No blocks, skip check-in

        current_block = None
        next_block = None
        for b in blocks:
            block_start = datetime.combine(today, b.start_time).replace(tzinfo=tz)
            block_end = datetime.combine(today, b.end_time).replace(tzinfo=tz)
            if block_start <= now <= block_end:
                current_block = b
            elif block_start > now and next_block is None:
                next_block = b

        lines = []
        if current_block:
            title = current_block.title or (current_block.task.title if current_block.task else "Task")
            end = current_block.end_time.strftime("%H:%M")
            lines.append(f"📋 Check-in: You should be working on \"{title}\" (until {end}).")
            lines.append("How's it going? Reply with an update or let me know if you need to reschedule.")
        elif next_block:
            title = next_block.title or (next_block.task.title if next_block.task else "Task")
            start = next_block.start_time.strftime("%H:%M")
            lines.append(f"📋 Next up: \"{title}\" at {start}.")

        if lines:
            await _send_notification("\n".join(lines))

    except Exception as exc:
        logger.error("Check-in error: %s", exc)


async def _send_notification(text: str):
    """Send a proactive notification to the user."""
    if not _bot or not _chat_id:
        return
    try:
        await _bot.send_message(chat_id=_chat_id, text=text, parse_mode=None)
    except Exception as exc:
        logger.error("Failed to send notification: %s", exc)


# ─── Shutdown ──────────────────────────────────────────────────────────────


async def shutdown_bot():
    """Graceful shutdown."""
    global _bot, _polling_task, _notification_task
    for task in [_polling_task, _notification_task]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    _polling_task = None
    _notification_task = None
    if _bot:
        try:
            await _bot.delete_webhook()
        except Exception:
            pass
        _bot = None


def get_bot():
    return _bot


# ─── Message Handler ──────────────────────────────────────────────────────


async def handle_telegram_message(
    chat_id: int,
    text: str,
    session: AsyncSession,
    llm: LLMAdapter,
    settings: Settings,
) -> None:
    """Process a Telegram message through Alfred's agentic loop and reply."""
    from app.services.chat_orchestrator import handle_message

    if not _bot:
        return

    # Send typing indicator
    try:
        await _bot.send_chat_action(chat_id=chat_id, action="typing")
    except Exception:
        pass

    try:
        response = await handle_message(
            message=text,
            session=session,
            llm=llm,
            timezone_str=settings.timezone,
        )

        reply = response.reply
        if not reply:
            reply = "I processed your request but have nothing to report, sir."

        # Send reply (plain text is safest)
        try:
            await _bot.send_message(
                chat_id=chat_id,
                text=reply,
                parse_mode=None,
            )
        except Exception:
            await _bot.send_message(chat_id=chat_id, text=reply)

    except Exception as exc:
        logger.error("Telegram message handler error: %s", exc)
        try:
            await _bot.send_message(
                chat_id=chat_id,
                text="I encountered an issue processing your request, sir. Please try again.",
            )
        except Exception:
            pass
