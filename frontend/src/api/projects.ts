import client from './client'

export interface Project {
  id: string
  title: string
  description: string | null
  notes: string | null
  color: string
  created_at: string
  task_count: number
}

export interface ProjectTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
}

export async function getProjects(): Promise<Project[]> {
  const { data } = await client.get<Project[]>('/projects')
  return data
}

export async function createProject(payload: {
  title: string
  description?: string
  color?: string
}): Promise<Project> {
  const { data } = await client.post<Project>('/projects', payload)
  return data
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await client.get<Project>(`/projects/${id}`)
  return data
}

export async function updateProject(
  id: string,
  payload: Partial<{ title: string; description: string; notes: string; color: string }>
): Promise<Project> {
  const { data } = await client.put<Project>(`/projects/${id}`, payload)
  return data
}

export async function deleteProject(id: string): Promise<void> {
  await client.delete(`/projects/${id}`)
}

export async function getProjectTasks(id: string): Promise<ProjectTask[]> {
  const { data } = await client.get<ProjectTask[]>(`/projects/${id}/tasks`)
  return data
}

export async function assignTaskToProject(projectId: string, taskId: string): Promise<void> {
  await client.post(`/projects/${projectId}/tasks/${taskId}`)
}

export async function removeTaskFromProject(projectId: string, taskId: string): Promise<void> {
  await client.delete(`/projects/${projectId}/tasks/${taskId}`)
}
