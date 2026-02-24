import type { CalendarBlock, BlockNote, WeekScheduleResponse, WeekScheduleRequest } from '@/types/calendar'
import client from './client'

export async function getWeekBlocks(weekStart: string): Promise<WeekScheduleResponse> {
  const { data } = await client.get<WeekScheduleResponse>('/calendar/blocks', {
    params: { week_start: weekStart },
  })
  return data
}

export async function triggerSchedule(
  request: WeekScheduleRequest,
): Promise<WeekScheduleResponse> {
  const { data } = await client.post<WeekScheduleResponse>('/calendar/schedule', request)
  return data
}

export async function createBlock(body: {
  task_id: string
  scheduled_date: string
  start_time: string
  end_time: string
}): Promise<CalendarBlock> {
  const { data } = await client.post<CalendarBlock>('/calendar/blocks', body)
  return data
}

export async function updateBlock(
  blockId: string,
  body: Partial<{
    scheduled_date: string
    start_time: string
    end_time: string
    is_locked: boolean
    status: string
    title: string
  }>,
): Promise<CalendarBlock> {
  const { data } = await client.put<CalendarBlock>(`/calendar/blocks/${blockId}`, body)
  return data
}

export async function deleteBlock(blockId: string): Promise<void> {
  await client.delete(`/calendar/blocks/${blockId}`)
}

export async function toggleBlockLock(blockId: string): Promise<CalendarBlock> {
  const { data } = await client.post<CalendarBlock>(`/calendar/blocks/${blockId}/lock`)
  return data
}

export async function getBlockDetail(blockId: string): Promise<CalendarBlock> {
  const { data } = await client.get<CalendarBlock>(`/calendar/blocks/${blockId}`)
  return data
}

export async function addBlockNote(blockId: string, content: string): Promise<BlockNote> {
  const { data } = await client.post<BlockNote>(`/calendar/blocks/${blockId}/notes`, { content })
  return data
}

export async function tagTask(blockId: string, taskId: string): Promise<void> {
  await client.post(`/calendar/blocks/${blockId}/tag`, { task_id: taskId })
}

export async function untagTask(blockId: string, taskId: string): Promise<void> {
  await client.delete(`/calendar/blocks/${blockId}/tag/${taskId}`)
}
