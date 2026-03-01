import type { Task } from './task'

export interface QuickAction {
  label: string
  action: string
  payload: Record<string, unknown>
}

export interface ReferencedTask {
  id: string
  title: string
}

export interface ReferencedBlock {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
}

export interface ChatResponse {
  reply: string
  intent_type: string | null
  tasks: Task[] | null
  task: Task | null
  quick_actions: QuickAction[] | null
  needs_confirmation: boolean
  confirmation_data: Record<string, unknown> | null
  actions_taken: string[] | null
}

export interface ThinkingStep {
  tool: string
  summary: string
  status: 'running' | 'done'
  result?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  task?: Task | null
  tasks?: Task[] | null
  quick_actions?: QuickAction[]
  loading?: boolean
  thinking_steps?: ThinkingStep[]
  referenced_tasks?: ReferencedTask[]
  referenced_blocks?: ReferencedBlock[]
}
