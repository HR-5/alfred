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
