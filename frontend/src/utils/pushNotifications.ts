/** Utilities for Web Push subscription management. */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    // Use existing registration if available, register fresh otherwise
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) return existing
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.warn('SW registration failed:', err)
    return null
  }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await registerServiceWorker()
    if (!registration) return null

    const activeReg = await navigator.serviceWorker.ready

    // If an existing subscription is present, verify it was created with the current VAPID key.
    // If the keys don't match (e.g. after key regeneration), unsubscribe and get a fresh one.
    const existing = await activeReg.pushManager.getSubscription()
    if (existing) {
      const rawKey = existing.options?.applicationServerKey
      if (rawKey) {
        const existingKey = new Uint8Array(rawKey)
        const currentKey = urlBase64ToUint8Array(vapidPublicKey)
        const keysMatch =
          existingKey.length === currentKey.length && existingKey.every((b, i) => b === currentKey[i])
        if (keysMatch) return existing
      }
      // Keys differ or unavailable — force a fresh subscription tied to the current VAPID key
      await existing.unsubscribe()
    }

    return await activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  } catch (err) {
    console.warn('Push subscribe failed (attempt 1):', err)

    // "push service error" / AbortError often means a stale subscription with
    // different VAPID keys is blocking. Unsubscribe and retry once.
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const stale = await reg.pushManager.getSubscription()
        if (stale) await stale.unsubscribe()

        const activeReg = await navigator.serviceWorker.ready
        return await activeReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }
    } catch (retryErr) {
      console.warn('Push subscribe failed (retry):', retryErr)
    }
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return false
    return await sub.unsubscribe()
  } catch {
    return false
  }
}

/**
 * Returns the current push subscription without hanging if no SW is registered.
 * Uses getRegistration() (non-blocking) instead of ready (blocks indefinitely).
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}
