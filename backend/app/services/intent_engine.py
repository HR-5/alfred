from datetime import date, timezone
import datetime

from app.llm.base import LLMAdapter
from app.llm.prompts.intent import build_intent_prompt
from app.llm.types import LLMMessage
from app.schemas.intent import ParsedIntent


async def parse_intent(
    user_message: str,
    llm: LLMAdapter,
    timezone_str: str = "UTC",
    conversation_context: list[LLMMessage] | None = None,
) -> ParsedIntent:
    """
    Parse a user message into a structured ParsedIntent using the LLM.
    Includes the last few conversation turns for context.
    """
    today = date.today()
    system_prompt = build_intent_prompt(today, timezone_str)

    messages: list[LLMMessage] = [
        LLMMessage(role="system", content=system_prompt),
    ]

    # Include last 6 messages (3 turns) for context
    if conversation_context:
        messages.extend(conversation_context[-6:])

    messages.append(LLMMessage(role="user", content=user_message))

    result = await llm.generate_structured(
        messages=messages,
        output_schema=ParsedIntent,
        temperature=0.1,
        retries=2,
    )
    return result
