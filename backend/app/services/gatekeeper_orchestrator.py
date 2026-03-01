"""
Gatekeeper orchestrator: strict Alfred mode for blocked-site access requests.
The user must argue their case; Alfred decides DENIED / SHORT_BREAK / LONG_BREAK.
"""

import logging
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from zoneinfo import ZoneInfo
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import LLMAdapter
from app.services import calendar_service
from app.services.chat_orchestrator import (
    _build_messages,
    _get_conversation_context,
    _log_turn,
    _sse,
)

logger = logging.getLogger(__name__)

GATEKEEPER_SYSTEM_PROMPT = """You are Alfred Pennyworth in strict GATEKEEPER MODE.
Your sole purpose right now: decide if the user deserves access to {site_name}.

Today is {today} ({day_of_week}). Current time: {current_time}.

Today's schedule:
{schedule}

## Access options (choose the strictest appropriate one)
- MICRO_BREAK (5 minutes): only if they have a truly trivial, specific thing to check. \
WARNING: this option triggers a 1-hour lockout afterwards — use it sparingly and make \
sure the user understands the consequence.
- SHORT_BREAK (10 minutes): a genuine quick mental reset after real, demonstrated work.
- LONG_BREAK (40 minutes): only after 2+ hours of sustained focus with a clear schedule gap.
- DENIED: default. Use this when in doubt.

## When to DENY (non-negotiable)
- Vague reason ("just checking", "bored", "quickly", "one video")
- Imminent deadlines or back-to-back schedule
- No concrete work accomplished today
- They haven't answered what they've done so far
- Procrastination vibes

## Your approach
- Cross-examine. Ask what they've accomplished. One or two stern sentences per reply.
- If granting MICRO_BREAK, explicitly warn them about the 1-hour lockout.
- No small talk. No encouragement. You are a gatekeeper, not a therapist.
- When you have reached a verdict, end your reply with EXACTLY one of:
    DECISION: DENIED
    DECISION: MICRO_BREAK
    DECISION: SHORT_BREAK
    DECISION: LONG_BREAK

## Personality
Terse. Disappointed but fair. Alfred who has seen this before, many times.
Address the user as "sir" occasionally."""


def _format_schedule(blocks: list) -> str:
    if not blocks:
        return "  (No scheduled blocks for today — a suspicious amount of free time, sir.)"
    lines = []
    for block in blocks:
        title = block.title or (block.task.title if block.task else "Untitled")
        start = block.start_time.strftime("%H:%M") if block.start_time else "?"
        end = block.end_time.strftime("%H:%M") if block.end_time else "?"
        lines.append(f"  {start}–{end}: {title}")
    return "\n".join(lines)


def _build_gatekeeper_prompt(tz: ZoneInfo, schedule_text: str, site_name: str) -> str:
    now = datetime.now(tz)
    return GATEKEEPER_SYSTEM_PROMPT.format(
        site_name=site_name,
        today=now.strftime("%Y-%m-%d"),
        day_of_week=now.strftime("%A"),
        current_time=now.strftime("%I:%M %p"),
        schedule=schedule_text,
    )


async def handle_gatekeeper_stream(
    message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    session_id: str | None = None,
    timezone_str: str = "UTC",
    site_name: str = "this site",
) -> AsyncGenerator[str, None]:
    """
    Streaming gatekeeper handler.
    Yields SSE events:
      - done:  {"reply": str}
      - error: {"message": str}
    """
    tz = ZoneInfo(timezone_str)

    # Namespace so gatekeeper turns never appear in main Alfred chat history
    gk_session_id = ("gk-" + session_id) if session_id else None

    try:
        # Fetch today's calendar for context injection
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        all_blocks = await calendar_service.get_week_blocks(week_start, session)
        today_blocks = [b for b in all_blocks if b.scheduled_date == today]
        schedule_text = _format_schedule(today_blocks)

        system_content = _build_gatekeeper_prompt(tz, schedule_text, site_name)

        await _log_turn("user", message, session, gk_session_id)
        context = await _get_conversation_context(session, gk_session_id, limit=10)
        messages = _build_messages(system_content, context, message)

        reply = await llm.generate(messages, temperature=0.4, max_tokens=512)

        await _log_turn("assistant", reply, session, gk_session_id)
        yield _sse("done", {"reply": reply})

    except Exception as exc:
        logger.error("Gatekeeper stream error: %s", exc)
        yield _sse("error", {"message": str(exc)})
