from fastapi import APIRouter, Depends, Request

from app.api.deps import get_llm_adapter, get_settings
from app.config import Settings
from app.llm.base import LLMAdapter

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings_endpoint(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "timezone": settings.timezone,
        "default_wake_time": settings.default_wake_time,
        "default_sleep_time": settings.default_sleep_time,
        "default_work_start": settings.default_work_start,
        "default_work_end": settings.default_work_end,
        "default_task_duration_min": settings.default_task_duration_min,
    }


@router.get("/llm/health")
async def llm_health(llm: LLMAdapter = Depends(get_llm_adapter)) -> dict:
    healthy = await llm.health_check()
    return {"healthy": healthy, "provider": llm.config.provider, "model": llm.config.model}
