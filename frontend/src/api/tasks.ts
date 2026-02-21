import type { Task, TaskListResponse } from '@/types/task'
import client from './client'

export async function getTasks(params?: {
  status?: string[]
  priority?: string
  q?: string
}): Promise<TaskListResponse> {
  const { data } = await client.get<TaskListResponse>('/tasks', { params })
  return data
}

export async function completeTask(taskId: string): Promise<Task> {
  const { data } = await client.post<Task>(`/tasks/${taskId}/complete`)
  return data
}

export async function deleteTask(taskId: string): Promise<void> {
  await client.delete(`/tasks/${taskId}`)
}
