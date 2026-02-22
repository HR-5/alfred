import type { ChatResponse } from '@/types/chat'
import client from './client'

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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentEvent = ''
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
