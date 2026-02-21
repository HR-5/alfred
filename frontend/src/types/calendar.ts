import type { Priority, EnergyLevel, TaskStatus } from './task'

export type BlockStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

export interface CalendarBlock {
  id: string
  task_id: string
  scheduled_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: BlockStatus
  is_locked: boolean
  task_title: string
  task_priority: Priority
  task_energy_level: EnergyLevel | null
  task_status: TaskStatus
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
