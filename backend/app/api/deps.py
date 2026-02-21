from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.llm.base import LLMAdapter


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_llm_adapter(request: Request) -> LLMAdapter:
    return request.app.state.llm


async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with request.app.state.session_factory() as session:
        yield session
