from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/assistant.db"

    llm_provider: Literal["ollama", "anthropic", "openai"] = "ollama"
    llm_model: str = "llama3.2"
    ollama_base_url: str = "http://localhost:11434"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    debug: bool = False
    timezone: str = "Asia/Kolkata"

    default_wake_time: str = "07:00"
    default_sleep_time: str = "23:00"
    default_work_start: str = "09:00"
    default_work_end: str = "17:00"
    default_task_duration_min: int = 30
    reminder_lead_time_min: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
