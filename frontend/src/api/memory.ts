import client from './client'

export interface Memory {
  id: string
  content: string
  category: string | null
  is_active: boolean
  created_at: string
}

export async function getMemories(): Promise<Memory[]> {
  const { data } = await client.get<Memory[]>('/memories')
  return data
}

export async function deleteMemory(id: string): Promise<void> {
  await client.delete(`/memories/${id}`)
}
