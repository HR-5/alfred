from typing import Literal, Optional

from pydantic import BaseModel


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMConfig(BaseModel):
    provider: Literal["ollama", "anthropic", "openai"]
    model: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    timeout: int = 60
