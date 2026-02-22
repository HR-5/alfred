import { create } from 'zustand'
import type { Message, ThinkingStep } from '@/types/chat'

interface ChatState {
  messages: Message[]
  loading: boolean
  sessionId: string
  draftMessage: string
  addMessage: (message: Message) => void
  updateLastAssistant: (update: Partial<Message>) => void
  addThinkingStep: (step: ThinkingStep) => void
  updateLastThinkingStep: (update: Partial<ThinkingStep>) => void
  setLoading: (loading: boolean) => void
  setDraftMessage: (text: string) => void
  clearMessages: () => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  sessionId: generateId(),
  draftMessage: '',

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistant: (update) =>
    set((state) => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], ...update }
          break
        }
      }
      return { messages: msgs }
    }),

  addThinkingStep: (step) =>
    set((state) => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].loading) {
          const steps = [...(msgs[i].thinking_steps || []), step]
          msgs[i] = { ...msgs[i], thinking_steps: steps }
          break
        }
      }
      return { messages: msgs }
    }),

  updateLastThinkingStep: (update) =>
    set((state) => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].thinking_steps?.length) {
          const steps = [...msgs[i].thinking_steps!]
          const lastIdx = steps.length - 1
          steps[lastIdx] = { ...steps[lastIdx], ...update }
          msgs[i] = { ...msgs[i], thinking_steps: steps }
          break
        }
      }
      return { messages: msgs }
    }),

  setLoading: (loading) => set({ loading }),

  setDraftMessage: (text) => set({ draftMessage: text }),

  clearMessages: () => set({ messages: [], sessionId: generateId() }),
}))
