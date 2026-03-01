import type { ChatResponse, Message } from '@/types/chat'
import client from './client'

export async function fetchChatHistory(sessionId: string, limit = 40): Promise<Message[]> {
  const { data } = await client.get<{ messages: Array<{ id: string; role: string; content: string; timestamp: string }> }>(
    '/chat/history',
    { params: { session_id: sessionId, limit } },
  )
  return data.messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.timestamp,
  }))
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>('/chat', {
    message,
    session_id: sessionId,
  })
  return data
}

export interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

/**
 * Stream chat via SSE. Calls onEvent for each server-sent event.
 */
export async function sendMessageStream(
  message: string,
  sessionId: string | undefined,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const resp = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  })

  if (!resp.ok || !resp.body) {
    throw new Error(`Stream failed: ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6))
          onEvent({ event: currentEvent, data })
        } catch {
          // skip malformed
        }
        currentEvent = ''
      }
    }
  }
}
