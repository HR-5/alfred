import client from './client'

export interface GoogleCalendarStatus {
  connected: boolean
  calendar_id?: string
  last_sync_at?: string | null
}

export async function getGoogleStatus(): Promise<GoogleCalendarStatus> {
  const { data } = await client.get('/integrations/google/status')
  return data
}

export async function connectGoogle(): Promise<{ auth_url: string }> {
  const { data } = await client.get('/integrations/google/connect')
  return data
}

export async function disconnectGoogle(): Promise<{ disconnected: boolean }> {
  const { data } = await client.post('/integrations/google/disconnect')
  return data
}

export async function syncGoogle(): Promise<{ pushed: number; pulled: number; updated: number }> {
  const { data } = await client.post('/integrations/google/sync')
  return data
}
