from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession


async def get_async_session(app_state) -> AsyncGenerator[AsyncSession, None]:
    async with app_state.session_factory() as session:
        yield session
