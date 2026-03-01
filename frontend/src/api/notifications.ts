import client from './client'

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const { data } = await client.get<{ public_key: string }>('/notifications/vapid-public-key')
    return data.public_key
  } catch {
    return null
  }
}

export async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await client.post('/notifications/subscribe', {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  })
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await client.delete('/notifications/subscribe', { data: { endpoint } })
}

export async function clearAllSubscriptions(): Promise<void> {
  await client.delete('/notifications/subscriptions')
}

export async function sendTestPush(): Promise<{ sent: number; total: number }> {
  const { data } = await client.post<{ sent: number; total: number }>('/notifications/test-push')
  return data
}
