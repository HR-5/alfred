import client from './client'

export interface BlockedSite {
  id: string
  name: string
  pattern: string
  created_at: string
}

export async function getBlockedSites(): Promise<BlockedSite[]> {
  const { data } = await client.get<BlockedSite[]>('/blocked-sites')
  return data
}

export async function createBlockedSite(name: string, pattern: string): Promise<BlockedSite> {
  const { data } = await client.post<BlockedSite>('/blocked-sites', { name, pattern })
  return data
}

export async function deleteBlockedSite(id: string): Promise<void> {
  await client.delete(`/blocked-sites/${id}`)
}
