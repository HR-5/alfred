from abc import ABC, abstractmethod
from typing import Any, TypeVar

from pydantic import BaseModel

from app.llm.types import LLMConfig, LLMMessage, LLMToolResponse

T = TypeVar("T", bound=BaseModel)


class LLMAdapter(ABC):
    """Abstract base class for all LLM provider adapters."""

    def __init__(self, config: LLMConfig) -> None:
        self.config = config

    @abstractmethod
    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate a free-form text response."""
        ...

    @abstractmethod
    async def generate_structured(
        self,
        messages: list[LLMMessage],
        output_schema: type[T],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        retries: int = 2,
    ) -> T:
        """
        Generate a response conforming to a Pydantic schema.
        Validates output and retries on schema violations.
        """
        ...

    @abstractmethod
    async def generate_with_tools(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.5,
        max_tokens: int = 4096,
    ) -> LLMToolResponse:
        """Generate a response that may include tool calls."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify the provider is reachable and the model is available."""
        ...
