from typing import Any, Literal, Optional, Union

from pydantic import BaseModel


class LLMMessage(BaseModel):
    """A message in the LLM conversation.

    For simple text messages, `content` is a string.
    For tool-result messages, `content` is a list of content blocks.
    """
    role: Literal["system", "user", "assistant"]
    content: Union[str, list[dict[str, Any]]]


class LLMConfig(BaseModel):
    provider: Literal["ollama", "anthropic", "openai"]
    model: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    timeout: int = 60


class ToolCall(BaseModel):
    """A tool invocation requested by the LLM."""
    id: str
    name: str
    input: dict[str, Any]


class LLMToolResponse(BaseModel):
    """Response from generate_with_tools()."""
    type: Literal["text", "tool_use"]
    content: str = ""
    tool_calls: list[ToolCall] = []
    raw_content: list[dict[str, Any]] = []
