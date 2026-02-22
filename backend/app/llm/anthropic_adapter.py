import json
import logging
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.llm.base import LLMAdapter
from app.llm.types import LLMConfig, LLMMessage, LLMToolResponse, ToolCall

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class AnthropicAdapter(LLMAdapter):
    """Claude adapter using the Anthropic SDK."""

    def __init__(self, config: LLMConfig) -> None:
        super().__init__(config)
        try:
            import anthropic
            self._client = anthropic.AsyncAnthropic(api_key=config.api_key)
        except ImportError as exc:
            raise ImportError(
                "Install the anthropic package: pip install anthropic"
            ) from exc

    def _split_messages(
        self, messages: list[LLMMessage]
    ) -> tuple[str, list[dict]]:
        system = ""
        chat: list[dict] = []
        for m in messages:
            if m.role == "system":
                system = m.content if isinstance(m.content, str) else json.dumps(m.content)
            else:
                chat.append({"role": m.role, "content": m.content})
        return system, chat

    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        system, chat = self._split_messages(messages)
        resp = await self._client.messages.create(
            model=self.config.model,
            system=system,
            messages=chat,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.content[0].text

    async def generate_structured(
        self,
        messages: list[LLMMessage],
        output_schema: type[T],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        retries: int = 2,
    ) -> T:
        system, chat = self._split_messages(messages)
        tool_name = "structured_output"
        tool_def = {
            "name": tool_name,
            "description": "Return the response in the required structured format.",
            "input_schema": output_schema.model_json_schema(),
        }

        for attempt in range(retries + 1):
            resp = await self._client.messages.create(
                model=self.config.model,
                system=system,
                messages=chat,
                max_tokens=max_tokens,
                temperature=temperature,
                tools=[tool_def],
                tool_choice={"type": "tool", "name": tool_name},
            )
            tool_block = next(
                (b for b in resp.content if b.type == "tool_use"), None
            )
            if tool_block is None:
                raw = resp.content[0].text if resp.content else ""
                if attempt < retries:
                    chat.append({"role": "assistant", "content": raw})
                    chat.append({"role": "user", "content": "Please use the structured_output tool."})
                    continue
                raise ValueError("No tool_use block in Anthropic response.")

            try:
                return output_schema.model_validate(tool_block.input)
            except (ValidationError, json.JSONDecodeError) as exc:
                if attempt < retries:
                    chat.append({"role": "assistant", "content": str(tool_block.input)})
                    chat.append({
                        "role": "user",
                        "content": f"Validation error: {exc}. Please try again.",
                    })
                else:
                    raise ValueError(f"Structured output failed after {retries + 1} attempts: {exc}") from exc

        raise RuntimeError("Unreachable")

    async def generate_with_tools(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.5,
        max_tokens: int = 4096,
    ) -> LLMToolResponse:
        system, chat = self._split_messages(messages)
        resp = await self._client.messages.create(
            model=self.config.model,
            system=system,
            messages=chat,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=tools,
        )

        # Extract text and tool_use blocks
        text_parts = []
        tool_calls = []
        raw_content = []

        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
                raw_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                tool_calls.append(ToolCall(
                    id=block.id,
                    name=block.name,
                    input=block.input,
                ))
                raw_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })

        if tool_calls:
            return LLMToolResponse(
                type="tool_use",
                content="\n".join(text_parts),
                tool_calls=tool_calls,
                raw_content=raw_content,
            )

        return LLMToolResponse(
            type="text",
            content="\n".join(text_parts),
            raw_content=raw_content,
        )

    async def health_check(self) -> bool:
        try:
            await self._client.messages.create(
                model=self.config.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
            )
            return True
        except Exception as exc:
            logger.warning("Anthropic health check failed: %s", exc)
            return False
