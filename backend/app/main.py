import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.config import Settings
from app.db.engine import create_db_engine, create_session_factory
from app.llm.factory import create_llm_adapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()

    # Ensure data directory exists
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    os.makedirs(os.path.dirname(db_path) if "/" in db_path else ".", exist_ok=True)

    # Database
    engine = create_db_engine(settings.database_url)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)

    # LLM adapter
    app.state.llm = create_llm_adapter(settings)
    logger.info("LLM adapter: %s / %s", settings.llm_provider, settings.llm_model)

    yield

    await engine.dispose()


def create_app() -> FastAPI:
    settings = Settings()

    app = FastAPI(
        title="Alfred",
        version="0.1.0",
        description="Your personal AI butler for tasks, calendar, and accountability",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
