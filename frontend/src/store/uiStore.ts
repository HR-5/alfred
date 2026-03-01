import { create } from 'zustand'
import type { CalendarBlock } from '@/types/calendar'
import type { ReferencedTask } from '@/types/chat'

type View = 'chat' | 'tasks' | 'calendar' | 'daily' | 'insights' | 'settings'

interface UIState {
  activeView: View
  sidebarOpen: boolean
  pinnedEvent: CalendarBlock | null
  pinnedTask: ReferencedTask | null
  setActiveView: (view: View) => void
  toggleSidebar: () => void
  setPinnedEvent: (block: CalendarBlock | null) => void
  setPinnedTask: (task: ReferencedTask | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'chat',
  sidebarOpen: true,
  pinnedEvent: null,
  pinnedTask: null,
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPinnedEvent: (block) => set({ pinnedEvent: block }),
  setPinnedTask: (task) => set({ pinnedTask: task }),
}))
