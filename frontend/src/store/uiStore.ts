import { create } from 'zustand'

type View = 'chat' | 'tasks' | 'calendar' | 'daily' | 'insights' | 'settings'

interface UIState {
  activeView: View
  sidebarOpen: boolean
  setActiveView: (view: View) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'chat',
  sidebarOpen: true,
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
