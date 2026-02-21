import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { sendMessage } from '@/api/chat'
import { completeTask, deleteTask } from '@/api/tasks'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import type { Message } from '@/types/chat'

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function ChatPanel() {
  const { addMessage, setLoading, sessionId } = useChatStore()

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
      }
      addMessage(loadingMsg)
      setLoading(true)

      try {
        const resp = await sendMessage(text, sessionId)
        const assistantMsg: Message = {
          id: makeId(),
          role: 'assistant',
          content: resp.reply,
          timestamp: new Date().toISOString(),
          task: resp.task,
          tasks: resp.tasks,
          quick_actions: resp.quick_actions ?? undefined,
        }
        // Replace loading message
        useChatStore.setState((state) => ({
          messages: [...state.messages.slice(0, -1), assistantMsg],
        }))
      } catch {
        const errorMsg: Message = {
          id: makeId(),
          role: 'assistant',
          content: 'Something went wrong. Make sure the backend is running and the LLM is available.',
          timestamp: new Date().toISOString(),
        }
        useChatStore.setState((state) => ({
          messages: [...state.messages.slice(0, -1), errorMsg],
        }))
      } finally {
        setLoading(false)
      }
    },
    [addMessage, setLoading, sessionId]
  )

  const handleQuickAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const taskId = payload.task_id as string
      if (!taskId) return

      try {
        if (action === 'complete_task') {
          await completeTask(taskId)
          const msg: Message = {
            id: makeId(),
            role: 'assistant',
            content: 'Task marked as done!',
            timestamp: new Date().toISOString(),
          }
          addMessage(msg)
        } else if (action === 'delete_task') {
          await deleteTask(taskId)
          const msg: Message = {
            id: makeId(),
            role: 'assistant',
            content: 'Task deleted.',
            timestamp: new Date().toISOString(),
          }
          addMessage(msg)
        }
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
        <h2 className="text-sm font-medium text-text-primary">Alfred Pennyworth</h2>
        <p className="text-xs text-text-muted">At your service, Master Wayne.</p>
      </div>
      <MessageList onQuickAction={handleQuickAction} />
      <ChatInput onSend={handleSend} />
    </div>
  )
}
