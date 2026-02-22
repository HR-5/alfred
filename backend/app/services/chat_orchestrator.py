"""
Agentic chat orchestrator: user message → LLM with tools → execute tools → loop → response.

Supports both synchronous (handle_message) and streaming (handle_message_stream) modes.
"""

import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.llm.base import LLMAdapter
from app.llm.types import LLMMessage
from app.models.conversation import ConversationLog
from app.schemas.chat import ChatResponse
from app.services.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

MAX_TOOL_TURNS = 8

SYSTEM_PROMPT = """You are Alfred Pennyworth — the same Alfred who keeps the Batcave running, patches up Bruce Wayne after a long night, and always has the right words at the right time.

You are embedded in a personal task and calendar management system. You have access to tools to manage the user's tasks and calendar. Use them to fulfill requests.

Today is {today} ({day_of_week}). Current time: {current_time}. Timezone: {timezone}.

## Personality
- Speak like Alfred from the Batman universe: composed, dry British wit, occasionally sardonic.
- Concise and practical. You don't waste words.
- Address the user respectfully — "sir" or "Master Wayne" occasionally, but don't overdo it.
- When things go wrong, stay calm. "Might I suggest a different approach, sir?"

## Tool Usage Guidelines
- When the user asks to see, list, or query tasks, use the `list_tasks` or `find_tasks` tool.
- When the user asks to delete, complete, or modify tasks, FIRST use `find_tasks` or `list_tasks` to get the task IDs, then use the appropriate tool with those IDs.
- For bulk operations (e.g. "delete all tasks for today"), query first, then call delete/complete for each result.
- For calendar operations (e.g. "clear my calendar"), use `get_calendar_blocks` then `delete_calendar_block` for each.
- For "move my 3pm meeting to 5pm", use `get_calendar_blocks` to find the block, then `update_calendar_block`.
- Always use tool results to provide accurate information — never fabricate task names or IDs.
- When creating tasks, infer reasonable defaults:
  - "quick call" → 15 min, "meeting" → 30 min, "deep work" → 60 min
  - "urgent"/"ASAP" → critical priority, "important" → high priority
  - Resolve relative dates: "tomorrow" → next calendar day, "next Monday" → upcoming Monday
  - "tonight"/"this evening" → today at 20:00

## Response Guidelines
- After performing actions, summarize what you did clearly.
- If a search returns no results, tell the user.
- For destructive bulk operations, briefly list what will be affected, then proceed.
- Keep responses short — a few sentences max.
"""

# Human-readable labels for tool calls
TOOL_LABELS = {
    "list_tasks": "Searching tasks",
    "create_task": "Creating task",
    "update_task": "Updating task",
    "delete_task": "Removing task",
    "complete_task": "Completing task",
    "find_tasks": "Looking up tasks",
    "get_calendar_blocks": "Checking calendar",
    "delete_calendar_block": "Clearing calendar block",
    "update_calendar_block": "Moving calendar block",
    "schedule_week": "Running scheduler",
}


def _tool_step_summary(tool_name: str, tool_input: dict) -> str:
    """Generate a short one-liner for a tool call."""
    label = TOOL_LABELS.get(tool_name, tool_name)
    # Add context from input
    if tool_name == "find_tasks" and tool_input.get("query"):
        return f'{label} for "{tool_input["query"]}"'
    if tool_name == "create_task" and tool_input.get("title"):
        return f'{label}: {tool_input["title"]}'
    if tool_name == "delete_task":
        return label
    if tool_name == "list_tasks":
        filters = []
        if tool_input.get("due_date"):
            filters.append(f"due {tool_input['due_date']}")
        if tool_input.get("status"):
            filters.append(f"status={','.join(tool_input['status'])}")
        if filters:
            return f"{label} ({', '.join(filters)})"
    if tool_name == "get_calendar_blocks":
        if tool_input.get("start_date"):
            return f"{label} for {tool_input['start_date']}"
    return label


def _tool_result_summary(tool_name: str, result: dict) -> str:
    """Generate a short summary of a tool result."""
    if "error" in result:
        return f"Error: {result['error']}"
    if tool_name in ("list_tasks", "find_tasks"):
        count = len(result.get("tasks", []))
        return f"Found {count} task{'s' if count != 1 else ''}"
    if tool_name == "create_task":
        title = result.get("created", {}).get("title", "")
        return f"Created: {title}"
    if tool_name == "delete_task":
        return f"Deleted: {result.get('title', 'task')}"
    if tool_name == "complete_task":
        title = result.get("completed", {}).get("title", "")
        return f"Done: {title}"
    if tool_name == "get_calendar_blocks":
        count = len(result.get("blocks", []))
        return f"Found {count} block{'s' if count != 1 else ''}"
    if tool_name == "delete_calendar_block":
        return f"Removed: {result.get('task_title', 'block')}"
    if tool_name == "schedule_week":
        return f"Scheduled {result.get('scheduled_count', 0)} tasks"
    return "Done"


def _build_messages(
    system_content: str,
    context: list[LLMMessage],
    user_message: str,
) -> list[LLMMessage]:
    messages: list[LLMMessage] = [
        LLMMessage(role="system", content=system_content),
    ]
    messages.extend(context)
    messages.append(LLMMessage(role="user", content=user_message))
    return messages


def _build_system_prompt(tz: ZoneInfo) -> str:
    now = datetime.now(tz)
    return SYSTEM_PROMPT.format(
        today=now.strftime("%Y-%m-%d"),
        day_of_week=now.strftime("%A"),
        current_time=now.strftime("%I:%M %p"),
        timezone=str(tz),
    )


async def handle_message(
    message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    session_id: str | None = None,
    timezone_str: str = "UTC",
) -> ChatResponse:
    """Non-streaming handler — returns the full response at once."""
    settings = Settings()
    tz = ZoneInfo(timezone_str)

    await _log_turn("user", message, session, session_id)
    context = await _get_conversation_context(session, session_id)
    system_content = _build_system_prompt(tz)
    messages = _build_messages(system_content, context, message)

    actions_taken: list[str] = []
    final_text = ""

    for _ in range(MAX_TOOL_TURNS):
        result = await llm.generate_with_tools(
            messages, TOOL_DEFINITIONS, temperature=0.3, max_tokens=4096
        )
        if result.type == "text":
            final_text = result.content
            break

        messages.append(LLMMessage(role="assistant", content=result.raw_content))
        tool_results = []
        for call in result.tool_calls:
            output = await execute_tool(call.name, call.input, session, settings)
            actions_taken.append(call.name)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call.id,
                "content": json.dumps(output),
            })
        messages.append(LLMMessage(role="user", content=tool_results))
    else:
        final_text = (
            "I seem to have gotten carried away, sir. Could you try rephrasing?"
        )

    await _log_turn("assistant", final_text, session, session_id)
    return ChatResponse(
        reply=final_text,
        actions_taken=actions_taken if actions_taken else None,
    )


async def handle_message_stream(
    message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    session_id: str | None = None,
    timezone_str: str = "UTC",
) -> AsyncGenerator[str, None]:
    """
    Streaming handler — yields SSE events as the agentic loop progresses.

    Event types:
      - step: A tool call starting {"tool": str, "summary": str}
      - step_done: A tool call completed {"tool": str, "summary": str}
      - done: Final response {"reply": str, "actions_taken": [...]}
      - error: Something went wrong {"message": str}
    """
    settings = Settings()
    tz = ZoneInfo(timezone_str)

    await _log_turn("user", message, session, session_id)
    context = await _get_conversation_context(session, session_id)
    system_content = _build_system_prompt(tz)
    messages = _build_messages(system_content, context, message)

    actions_taken: list[str] = []
    final_text = ""

    try:
        for _ in range(MAX_TOOL_TURNS):
            result = await llm.generate_with_tools(
                messages, TOOL_DEFINITIONS, temperature=0.3, max_tokens=4096
            )

            if result.type == "text":
                final_text = result.content
                break

            messages.append(
                LLMMessage(role="assistant", content=result.raw_content)
            )

            tool_results = []
            for call in result.tool_calls:
                # Emit step event
                step_summary = _tool_step_summary(call.name, call.input)
                yield _sse("step", {
                    "tool": call.name,
                    "summary": step_summary,
                    "input": call.input,
                })

                output = await execute_tool(
                    call.name, call.input, session, settings
                )
                actions_taken.append(call.name)

                # Emit step_done event
                result_summary = _tool_result_summary(call.name, output)
                yield _sse("step_done", {
                    "tool": call.name,
                    "summary": result_summary,
                })

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": json.dumps(output),
                })

            messages.append(LLMMessage(role="user", content=tool_results))
        else:
            final_text = (
                "I seem to have gotten carried away, sir. "
                "Could you try rephrasing?"
            )

        await _log_turn("assistant", final_text, session, session_id)
        yield _sse("done", {
            "reply": final_text,
            "actions_taken": actions_taken,
        })

    except Exception as exc:
        logger.error("Stream error: %s", exc)
        yield _sse("error", {"message": str(exc)})


def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _get_conversation_context(
    session: AsyncSession, session_id: str | None, limit: int = 10
) -> list[LLMMessage]:
    query = (
        select(ConversationLog)
        .order_by(desc(ConversationLog.created_at))
        .limit(limit)
    )
    if session_id:
        query = query.where(ConversationLog.session_id == session_id)
    result = await session.execute(query)
    logs = list(reversed(result.scalars().all()))
    return [LLMMessage(role=log.role, content=log.content) for log in logs]


async def _log_turn(
    role: str,
    content: str,
    session: AsyncSession,
    session_id: str | None = None,
) -> None:
    log = ConversationLog(
        role=role,
        content=content,
        session_id=session_id,
    )
    session.add(log)
    await session.commit()
