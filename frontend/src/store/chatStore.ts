import { create } from 'zustand'
import type { Message } from '@/types/chat'

interface ChatState {
  messages: Message[]
  loading: boolean
  sessionId: string
  addMessage: (message: Message) => void
  updateLastAssistant: (content: string) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  sessionId: generateId(),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistant: (content) =>
    set((state) => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content, loading: false }
          break
        }
      }
      return { messages: msgs }
    }),

  setLoading: (loading) => set({ loading }),

  clearMessages: () => set({ messages: [], sessionId: generateId() }),
}))
