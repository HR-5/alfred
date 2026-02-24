import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { sendMessageStream } from '@/api/chat'
import { completeTask, deleteTask } from '@/api/tasks'
import { emit, REFRESH_CALENDAR, REFRESH_TASKS } from '@/utils/events'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import type { Message } from '@/types/chat'

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function ChatPanel() {
  const { addMessage, addThinkingStep, updateLastThinkingStep, updateLastAssistant, setLoading, sessionId } = useChatStore()

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      }
      addMessage(userMsg)

      const loadingMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        loading: true,
        thinking_steps: [],
      }
      addMessage(loadingMsg)
      setLoading(true)

      try {
        await sendMessageStream(text, sessionId, (event) => {
          switch (event.event) {
            case 'step':
              addThinkingStep({
                tool: event.data.tool as string,
                summary: event.data.summary as string,
                status: 'running',
              })
              break
            case 'step_done':
              updateLastThinkingStep({
                status: 'done',
                result: event.data.summary as string,
              })
              break
            case 'done':
              updateLastAssistant({
                content: event.data.reply as string,
                loading: false,
              })
              // Refresh calendar + tasks since chat may have modified them
              emit(REFRESH_CALENDAR)
              emit(REFRESH_TASKS)
              break
            case 'error':
              updateLastAssistant({
                content: `Something went wrong: ${event.data.message}`,
                loading: false,
              })
              break
          }
        })
      } catch {
        updateLastAssistant({
          content: 'Something went wrong. Make sure the backend is running.',
          loading: false,
        })
      } finally {
        setLoading(false)
      }
    },
    [addMessage, addThinkingStep, updateLastThinkingStep, updateLastAssistant, setLoading, sessionId]
  )

  const handleQuickAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const taskId = payload.task_id as string
      if (!taskId) return

      try {
        if (action === 'complete_task') {
          await completeTask(taskId)
          addMessage({
            id: makeId(),
            role: 'assistant',
            content: 'Task marked as done!',
            timestamp: new Date().toISOString(),
          })
        } else if (action === 'delete_task') {
          await deleteTask(taskId)
          addMessage({
            id: makeId(),
            role: 'assistant',
            content: 'Task deleted.',
            timestamp: new Date().toISOString(),
          })
        }
        emit(REFRESH_CALENDAR)
        emit(REFRESH_TASKS)
      } catch {
        addMessage({
          id: makeId(),
          role: 'assistant',
          content: 'Failed to perform action.',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [addMessage]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Alfred Pennyworth</h2>
        <p className="text-xs text-text-muted">At your service, Master Wayne.</p>
      </div>
      <MessageList onQuickAction={handleQuickAction} />
      <ChatInput onSend={handleSend} />
    </div>
  )
}
