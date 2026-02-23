import type { Priority, EnergyLevel, TaskStatus } from './task'

export type BlockStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

export interface BlockNote {
  id: string
  content: string
  source: string
  created_at: string
}

export interface TaggedTask {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
}

export interface CalendarBlock {
  id: string
  task_id: string | null
  scheduled_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: BlockStatus
  is_locked: boolean
  source?: string
  title?: string | null
  task_title: string
  task_priority: Priority
  task_energy_level: EnergyLevel | null
  task_status: TaskStatus
  notes?: BlockNote[]
  tagged_tasks?: TaggedTask[]
}

export interface WeekScheduleResponse {
  blocks: CalendarBlock[]
  week_start: string
  week_end: string
  tasks_scheduled: number
  tasks_unschedulable: number
  unschedulable_task_ids: string[]
}

export interface WeekScheduleRequest {
  week_start: string
  force_reschedule?: boolean
}
