import { create } from 'zustand'
import type { Message, ThinkingStep } from '@/types/chat'

const SESSION_KEY = 'alfred_session_id'

function getOrCreateSessionId(): string {
  const stored = localStorage.getItem(SESSION_KEY)
  if (stored) return stored
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
  localStorage.setItem(SESSION_KEY, id)
  return id
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

interface ChatState {
  messages: Message[]
  loading: boolean
  sessionId: string
  draftMessage: string
  historyLoaded: boolean
  addMessage: (message: Message) => void
  updateLastAssistant: (update: Partial<Message>) => void
  addThinkingStep: (step: ThinkingStep) => void
  updateLastThinkingStep: (update: Partial<ThinkingStep>) => void
  setLoading: (loading: boolean) => void
  setDraftMessage: (text: string) => void
  clearMessages: () => void
  seedMessages: (messages: Message[]) => void
  setHistoryLoaded: (loaded: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  sessionId: getOrCreateSessionId(),
  draftMessage: '',
  historyLoaded: false,

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

  clearMessages: () => {
    const id = generateId()
    localStorage.setItem(SESSION_KEY, id)
    set({ messages: [], sessionId: id, historyLoaded: false })
  },

  seedMessages: (messages) => set({ messages }),

  setHistoryLoaded: (loaded) => set({ historyLoaded: loaded }),
}))
