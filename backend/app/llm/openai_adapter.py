import json
import logging
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.llm.base import LLMAdapter
from app.llm.types import LLMConfig, LLMMessage

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class OpenAIAdapter(LLMAdapter):
    """OpenAI adapter using structured outputs (json_schema) or function calling."""

    def __init__(self, config: LLMConfig) -> None:
        super().__init__(config)
        try:
            import openai
            self._client = openai.AsyncOpenAI(api_key=config.api_key or "")
        except ImportError as exc:
            raise ImportError(
                "Install the openai package: pip install openai"
            ) from exc

    def _to_openai_messages(self, messages: list[LLMMessage]) -> list[dict]:
        return [{"role": m.role, "content": m.content} for m in messages]

    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        resp = await self._client.chat.completions.create(
            model=self.config.model,
            messages=self._to_openai_messages(messages),
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""

    async def generate_structured(
        self,
        messages: list[LLMMessage],
        output_schema: type[T],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        retries: int = 2,
    ) -> T:
        oai_messages = self._to_openai_messages(messages)

        for attempt in range(retries + 1):
            try:
                resp = await self._client.chat.completions.create(
                    model=self.config.model,
                    messages=oai_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": output_schema.__name__,
                            "schema": output_schema.model_json_schema(),
                            "strict": True,
                        },
                    },
                )
                raw = resp.choices[0].message.content or ""
                return output_schema.model_validate_json(raw)
            except (ValidationError, json.JSONDecodeError) as exc:
                if attempt < retries:
                    logger.warning("Structured output attempt %d failed: %s", attempt + 1, exc)
                    oai_messages.append({"role": "assistant", "content": raw})
                    oai_messages.append({
                        "role": "user",
                        "content": f"Validation error: {exc}. Please return valid JSON.",
                    })
                else:
                    raise ValueError(f"Structured output failed after {retries + 1} attempts") from exc

        raise RuntimeError("Unreachable")

    async def health_check(self) -> bool:
        try:
            await self._client.chat.completions.create(
                model=self.config.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
            )
            return True
        except Exception as exc:
            logger.warning("OpenAI health check failed: %s", exc)
            return False
