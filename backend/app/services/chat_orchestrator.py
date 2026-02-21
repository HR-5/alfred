"""
Central dispatcher: user message → parse intent → route to service → build response.
"""
import json
import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import LLMAdapter
from app.llm.prompts.intent import build_conversational_prompt
from app.llm.types import LLMMessage
from app.models.conversation import ConversationLog
from app.schemas.chat import ChatResponse, QuickAction
from app.schemas.intent import IntentType, ParsedIntent
from app.services import intent_engine, task_service

logger = logging.getLogger(__name__)


async def _get_conversation_context(
    session: AsyncSession, session_id: str | None, limit: int = 6
) -> list[LLMMessage]:
    """Fetch the last N messages for this session to use as context."""
    from sqlalchemy import select, desc

    query = select(ConversationLog).order_by(desc(ConversationLog.created_at)).limit(limit)
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
    intent: ParsedIntent | None = None,
) -> None:
    log = ConversationLog(
        role=role,
        content=content,
        session_id=session_id,
        intent_type=intent.intent_type.value if intent else None,
        intent_data_json=json.dumps(intent.model_dump()) if intent else None,
    )
    session.add(log)
    await session.commit()


def _format_task_list(tasks) -> str:
    if not tasks:
        return "No tasks found."
    lines = []
    for t in tasks:
        due = f" (due {t.due_date})" if t.due_date else ""
        priority = f" [{t.priority.value}]" if t.priority.value != "none" else ""
        status_icon = {"done": "✓", "todo": "○", "in_progress": "◎", "snoozed": "⏸", "cancelled": "✗"}.get(
            t.status.value, "○"
        )
        lines.append(f"{status_icon} {t.title}{priority}{due}")
    return "\n".join(lines)


def _build_task_confirmation(task) -> str:
    lines = [f"  Title: {task.title}"]
    if task.due_date:
        time_part = f" at {task.due_time}" if task.due_time else ""
        lines.append(f"  When: {task.due_date}{time_part}")
    if task.priority.value != "none":
        lines.append(f"  Priority: {task.priority.value}")
    if task.estimated_minutes:
        lines.append(f"  Estimated: {task.estimated_minutes} min")
    if task.category:
        lines.append(f"  Category: {task.category}")
    return "\n".join(lines)


async def handle_message(
    message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    session_id: str | None = None,
    timezone_str: str = "UTC",
) -> ChatResponse:
    # Log user message
    await _log_turn("user", message, session, session_id)

    # Get conversation context
    context = await _get_conversation_context(session, session_id)

    # Parse intent
    try:
        intent = await intent_engine.parse_intent(
            message, llm, timezone_str, conversation_context=context
        )
    except Exception as exc:
        logger.error("Intent parsing failed: %s", exc)
        reply = "I had trouble understanding that. Could you rephrase?"
        await _log_turn("assistant", reply, session, session_id)
        return ChatResponse(reply=reply)

    logger.info("Intent: %s (%.2f) entities=%s", intent.intent_type, intent.confidence, intent.entities)

    # Route to handler
    response = await _route_intent(intent, message, session, llm, timezone_str)

    # Log assistant response
    await _log_turn("assistant", response.reply, session, session_id, intent)

    return response


async def _route_intent(
    intent: ParsedIntent,
    original_message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    timezone_str: str,
) -> ChatResponse:
    match intent.intent_type:
        case IntentType.ADD_TASK:
            return await _handle_add_task(intent, session)

        case IntentType.QUERY_TASKS:
            return await _handle_query_tasks(intent, session)

        case IntentType.COMPLETE_TASK:
            return await _handle_complete_task(intent, session)

        case IntentType.DELETE_TASK:
            return await _handle_delete_task(intent, session)

        case IntentType.RESCHEDULE_TASK:
            return await _handle_reschedule_task(intent, session)

        case IntentType.SNOOZE_TASK:
            return await _handle_snooze_task(intent, session)

        case IntentType.EDIT_TASK:
            return await _handle_edit_task(intent, session)

        case IntentType.ADD_NOTE:
            return await _handle_add_note(intent, session)

        case IntentType.AMBIGUOUS:
            question = intent.clarification_needed or "Could you be more specific?"
            return ChatResponse(reply=question, intent_type=intent.intent_type.value)

        case IntentType.CONVERSATIONAL | IntentType.GET_PLAN | IntentType.GET_REVIEW | IntentType.GET_INSIGHTS:
            return await _handle_conversational(original_message, session, llm, timezone_str)

        case _:
            return await _handle_conversational(original_message, session, llm, timezone_str)


async def _handle_add_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    if not e.get("title"):
        return ChatResponse(
            reply="What would you like to call this task?",
            intent_type=intent.intent_type.value,
        )

    task = await task_service.create_from_intent_entities(e, session)

    confirmation = _build_task_confirmation(task)
    quick_actions = [
        QuickAction(label="Edit", action="edit_task", payload={"task_id": task.id}),
        QuickAction(label="Delete", action="delete_task", payload={"task_id": task.id}),
    ]
    if task.due_date:
        quick_actions.insert(
            0,
            QuickAction(label="Mark Done", action="complete_task", payload={"task_id": task.id}),
        )

    from app.schemas.task import TaskResponse
    return ChatResponse(
        reply=f"Added:\n{confirmation}",
        intent_type=intent.intent_type.value,
        task=TaskResponse.model_validate(task),
        quick_actions=quick_actions,
    )


async def _handle_query_tasks(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    filter_status = None
    if e.get("filter_status"):
        filter_status = [e["filter_status"]] if isinstance(e["filter_status"], str) else e["filter_status"]

    due_before = None
    if e.get("filter_date"):
        try:
            due_before = date.fromisoformat(str(e["filter_date"]))
        except (ValueError, TypeError):
            pass

    tasks, total = await task_service.list_tasks(
        session,
        status=filter_status,
        priority=e.get("filter_priority"),
        due_before=due_before,
        limit=20,
    )

    task_list = _format_task_list(tasks)
    from app.schemas.task import TaskResponse
    reply = f"You have {total} task(s):\n\n{task_list}" if tasks else "No tasks found matching your query."

    return ChatResponse(
        reply=reply,
        intent_type=intent.intent_type.value,
        tasks=[TaskResponse.model_validate(t) for t in tasks],
    )


async def _handle_complete_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    task_ref = intent.entities.get("task_ref", "")
    matches = await task_service.find_by_fuzzy_title(task_ref, session)

    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\". Check your task list?",
            intent_type=intent.intent_type.value,
        )
    if len(matches) > 1:
        options = "\n".join(f"{i+1}. {t.title}" for i, t in enumerate(matches[:4]))
        return ChatResponse(
            reply=f"Which task did you complete?\n{options}",
            intent_type=intent.intent_type.value,
        )

    task = await task_service.complete_task(matches[0].id, session)
    from app.schemas.task import TaskResponse
    return ChatResponse(
        reply=f"Marked done: {task.title}",
        intent_type=intent.intent_type.value,
        task=TaskResponse.model_validate(task),
    )


async def _handle_delete_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    task_ref = intent.entities.get("task_ref", "")
    matches = await task_service.find_by_fuzzy_title(task_ref, session)

    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\".",
            intent_type=intent.intent_type.value,
        )
    if len(matches) > 1:
        options = "\n".join(f"{i+1}. {t.title}" for i, t in enumerate(matches[:4]))
        return ChatResponse(
            reply=f"Which task do you want to delete?\n{options}",
            intent_type=intent.intent_type.value,
        )

    task = matches[0]
    await task_service.delete_task(task.id, session)
    return ChatResponse(
        reply=f"Deleted: {task.title}",
        intent_type=intent.intent_type.value,
    )


async def _handle_reschedule_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    task_ref = e.get("task_ref", "")
    matches = await task_service.find_by_fuzzy_title(task_ref, session)

    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\".",
            intent_type=intent.intent_type.value,
        )
    if len(matches) > 1:
        options = "\n".join(f"{i+1}. {t.title}" for i, t in enumerate(matches[:4]))
        return ChatResponse(
            reply=f"Which task do you want to reschedule?\n{options}",
            intent_type=intent.intent_type.value,
        )

    task = matches[0]
    update_data: dict = {}
    if e.get("new_date"):
        try:
            update_data["due_date"] = date.fromisoformat(str(e["new_date"]))
            task.times_rescheduled += 1
        except (ValueError, TypeError):
            pass
    if e.get("new_time"):
        update_data["due_time"] = e["new_time"]

    if not update_data:
        return ChatResponse(
            reply="When would you like to reschedule it to?",
            intent_type=intent.intent_type.value,
        )

    from app.schemas.task import TaskUpdate, TaskResponse
    updated = await task_service.update_task(task.id, TaskUpdate(**update_data), session)
    due_str = f"{updated.due_date}" + (f" at {updated.due_time}" if updated.due_time else "")
    return ChatResponse(
        reply=f"Rescheduled \"{updated.title}\" to {due_str}.",
        intent_type=intent.intent_type.value,
        task=TaskResponse.model_validate(updated),
    )


async def _handle_snooze_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    task_ref = e.get("task_ref", "")
    snooze_minutes = int(e.get("snooze_minutes", 30))
    matches = await task_service.find_by_fuzzy_title(task_ref, session)

    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\".",
            intent_type=intent.intent_type.value,
        )

    task = await task_service.snooze_task(matches[0].id, snooze_minutes, session)
    from app.schemas.task import TaskResponse
    return ChatResponse(
        reply=f"Snoozed \"{task.title}\" for {snooze_minutes} minutes.",
        intent_type=intent.intent_type.value,
        task=TaskResponse.model_validate(task),
    )


async def _handle_edit_task(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    task_ref = e.get("task_ref", "")
    matches = await task_service.find_by_fuzzy_title(task_ref, session)

    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\".",
            intent_type=intent.intent_type.value,
        )
    if len(matches) > 1:
        options = "\n".join(f"{i+1}. {t.title}" for i, t in enumerate(matches[:4]))
        return ChatResponse(
            reply=f"Which task do you want to edit?\n{options}",
            intent_type=intent.intent_type.value,
        )

    task = matches[0]
    changes = e.get("changes", {})
    if not changes:
        # Changes may be at top-level entities
        changes = {k: v for k, v in e.items() if k not in ("task_ref",) and v is not None}

    from app.schemas.task import TaskUpdate, TaskResponse
    from app.models.task import Priority, EnergyLevel, TaskStatus

    update_fields: dict = {}
    if changes.get("title"):
        update_fields["title"] = changes["title"]
    if changes.get("priority"):
        priority_map = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}
        p = priority_map.get(str(changes["priority"]).lower())
        if p:
            update_fields["priority"] = Priority(p)
    if changes.get("due_date"):
        try:
            update_fields["due_date"] = date.fromisoformat(str(changes["due_date"]))
        except (ValueError, TypeError):
            pass
    if changes.get("due_time"):
        update_fields["due_time"] = changes["due_time"]

    if not update_fields:
        return ChatResponse(
            reply=f"What would you like to change about \"{task.title}\"?",
            intent_type=intent.intent_type.value,
        )

    updated = await task_service.update_task(task.id, TaskUpdate(**update_fields), session)
    changed_summary = ", ".join(f"{k}={v}" for k, v in update_fields.items())
    return ChatResponse(
        reply=f"Updated \"{updated.title}\" — {changed_summary}.",
        intent_type=intent.intent_type.value,
        task=TaskResponse.model_validate(updated),
    )


async def _handle_add_note(intent: ParsedIntent, session: AsyncSession) -> ChatResponse:
    e = intent.entities
    task_ref = e.get("task_ref", "")
    note_content = e.get("note_content", "")

    if not note_content:
        return ChatResponse(
            reply="What note would you like to add?",
            intent_type=intent.intent_type.value,
        )

    matches = await task_service.find_by_fuzzy_title(task_ref, session)
    if not matches:
        return ChatResponse(
            reply=f"I couldn't find a task matching \"{task_ref}\".",
            intent_type=intent.intent_type.value,
        )

    await task_service.add_note(matches[0].id, note_content, session)
    return ChatResponse(
        reply=f"Note added to \"{matches[0].title}\".",
        intent_type=intent.intent_type.value,
    )


async def _handle_conversational(
    message: str,
    session: AsyncSession,
    llm: LLMAdapter,
    timezone_str: str,
) -> ChatResponse:
    today = date.today()
    system_prompt = build_conversational_prompt(today, timezone_str)

    context = await _get_conversation_context(session, None, limit=8)
    messages = [LLMMessage(role="system", content=system_prompt)]
    messages.extend(context)
    messages.append(LLMMessage(role="user", content=message))

    reply = await llm.generate(messages, temperature=0.7, max_tokens=500)
    return ChatResponse(reply=reply, intent_type=IntentType.CONVERSATIONAL.value)
