import json
import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.llm.base import LLMAdapter
from app.llm.types import LLMConfig, LLMMessage

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class OllamaAdapter(LLMAdapter):
    """Ollama LLM adapter using the Ollama REST API."""

    def __init__(self, config: LLMConfig) -> None:
        super().__init__(config)
        self._base_url = (config.base_url or "http://localhost:11434").rstrip("/")

    def _make_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.config.timeout)

    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        payload = {
            "model": self.config.model,
            "messages": [m.model_dump() for m in messages],
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with self._make_client() as client:
            resp = await client.post(f"{self._base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    async def generate_structured(
        self,
        messages: list[LLMMessage],
        output_schema: type[T],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        retries: int = 2,
    ) -> T:
        schema = output_schema.model_json_schema()
        # Ollama supports native JSON schema enforcement via `format`
        payload = {
            "model": self.config.model,
            "messages": [m.model_dump() for m in messages],
            "stream": False,
            "format": schema,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

        conv_messages = list(messages)
        for attempt in range(retries + 1):
            async with self._make_client() as client:
                resp = await client.post(f"{self._base_url}/api/chat", json=payload)
                resp.raise_for_status()
                raw = resp.json()["message"]["content"]

            try:
                return output_schema.model_validate_json(raw)
            except (ValidationError, json.JSONDecodeError) as exc:
                if attempt < retries:
                    logger.warning("Structured output attempt %d failed: %s", attempt + 1, exc)
                    conv_messages = list(conv_messages) + [
                        LLMMessage(role="assistant", content=raw),
                        LLMMessage(
                            role="user",
                            content=(
                                f"Your response did not match the required JSON schema. "
                                f"Error: {exc}. "
                                f"Please respond with valid JSON matching the schema exactly."
                            ),
                        ),
                    ]
                    payload["messages"] = [m.model_dump() for m in conv_messages]
                else:
                    raise ValueError(
                        f"Failed to get valid structured output after {retries + 1} attempts. "
                        f"Last error: {exc}. Last response: {raw}"
                    ) from exc

        raise RuntimeError("Unreachable")

    async def health_check(self) -> bool:
        try:
            async with self._make_client() as client:
                resp = await client.get(f"{self._base_url}/api/tags", timeout=5)
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
                # Check if configured model is available (allow partial match)
                return any(self.config.model in m for m in models)
        except Exception as exc:
            logger.warning("Ollama health check failed: %s", exc)
            return False
