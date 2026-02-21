from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine


def create_db_engine(database_url: str) -> AsyncEngine:
    return create_async_engine(
        database_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)
