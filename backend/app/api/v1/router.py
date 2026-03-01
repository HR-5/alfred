from fastapi import APIRouter

from app.api.v1 import calendar, chat, tasks, settings, integrations, telegram, memory, notifications, projects

api_v1_router = APIRouter()
api_v1_router.include_router(chat.router)
api_v1_router.include_router(tasks.router)
api_v1_router.include_router(calendar.router)
api_v1_router.include_router(settings.router)
api_v1_router.include_router(integrations.router)
api_v1_router.include_router(telegram.router)
api_v1_router.include_router(memory.router)
api_v1_router.include_router(notifications.router)
api_v1_router.include_router(projects.router)
