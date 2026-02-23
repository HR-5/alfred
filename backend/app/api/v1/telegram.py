"""Telegram webhook endpoint."""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_settings, get_llm_adapter
from app.config import Settings
from app.llm.base import LLMAdapter
from app.services import telegram_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    llm: LLMAdapter = Depends(get_llm_adapter),
):
    """Receive Telegram updates via webhook."""
    try:
        from telegram import Update

        body = await request.json()
        update = Update.de_json(body, telegram_service.get_bot())

        if update and update.message and update.message.text:
            chat_id = update.message.chat_id
            text = update.message.text

            # Skip /start command
            if text.strip() == "/start":
                bot = telegram_service.get_bot()
                if bot:
                    await bot.send_message(
                        chat_id=chat_id,
                        text="Good evening, sir. I'm Alfred, your personal task assistant. How may I help you today?",
                    )
                return {"ok": True}

            await telegram_service.handle_telegram_message(
                chat_id=chat_id,
                text=text,
                session=session,
                llm=llm,
                settings=settings,
            )

        return {"ok": True}
    except Exception as exc:
        logger.error("Telegram webhook error: %s", exc)
        return {"ok": True}  # Always return 200 to Telegram
