export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'snoozed'
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'none'
export type EnergyLevel = 'high' | 'medium' | 'low'

export interface TaskNote {
  id: string
  content: string
  source: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  energy_level: EnergyLevel | null
  category: string | null
  context: string | null
  due_date: string | null
  due_time: string | null
  estimated_minutes: number | null
  recurrence_type: string
  times_snoozed: number
  times_rescheduled: number
  completed_at: string | null
  created_at: string
  updated_at: string
  notes: TaskNote[]
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
}
