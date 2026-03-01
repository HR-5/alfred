import { useState, useEffect } from 'react'
import client from '@/api/client'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import {
  getGoogleStatus,
  connectGoogle,
  disconnectGoogle,
  syncGoogle,
  type GoogleCalendarStatus,
} from '@/api/integrations'
import { getMemories, deleteMemory, type Memory } from '@/api/memory'
import { getVapidPublicKey, saveSubscription, removeSubscription, clearAllSubscriptions, sendTestPush } from '@/api/notifications'
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '@/utils/pushNotifications'

interface Props {
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  preference: 'Preference',
  habit: 'Habit',
  fact: 'Fact',
  schedule: 'Schedule',
  other: 'Other',
}

export default function SettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [health, setHealth] = useState<{ healthy: boolean; provider: string; model: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [testPushLoading, setTestPushLoading] = useState(false)
  const [testPushResult, setTestPushResult] = useState<string | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentSubscription().then((sub) => setPushEnabled(!!sub))
    setPushSupported(isPushSupported())
  }, [])

  useEffect(() => {
    Promise.all([
      client.get('/settings').then((r) => r.data),
      client.get('/settings/llm/health').then((r) => r.data).catch(() => null),
      getGoogleStatus().catch(() => ({ connected: false })),
      getMemories().catch(() => []),
    ]).then(([s, h, g, m]) => {
      setSettings(s)
      setHealth(h)
      setGcalStatus(g)
      setMemories(m)
      setLoading(false)
    })
  }, [])

  const checkHealth = async () => {
    setHealth(null)
    try {
      const { data } = await client.get('/settings/llm/health')
      setHealth(data)
    } catch {
      setHealth({ healthy: false, provider: 'unknown', model: 'unknown' })
    }
  }

  const handleGoogleConnect = async () => {
    try {
      const { auth_url } = await connectGoogle()
      window.open(auth_url, '_blank')
    } catch {
      // ignore
    }
  }

  const handleGoogleDisconnect = async () => {
    await disconnectGoogle()
    setGcalStatus({ connected: false })
    setSyncResult(null)
  }

  const handleGoogleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncGoogle()
      setSyncResult(`Pushed ${result.pushed}, pulled ${result.pulled} events`)
      const status = await getGoogleStatus()
      setGcalStatus(status)
    } catch {
      setSyncResult('Sync failed')
    }
    setSyncing(false)
  }

  const handleDeleteMemory = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteMemory(id)
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // ignore
    }
    setDeletingId(null)
  }

  const handleResetPush = async () => {
    setPushLoading(true)
    setPushError(null)
    setTestPushResult(null)
    try {
      // 1. Clear browser-side subscription
      await unsubscribeFromPush()
      // 2. Clear all DB subscriptions
      await clearAllSubscriptions().catch(() => {})
      setPushEnabled(false)
      // 3. Re-subscribe with current VAPID key (forces fresh endpoint)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushError('Notification permission denied.')
        return
      }
      const vapidKey = await getVapidPublicKey()
      if (!vapidKey) {
        setPushError('Backend VAPID key not available.')
        return
      }
      const sub = await subscribeToPush(vapidKey)
      if (sub) {
        await saveSubscription(sub)
        setPushEnabled(true)
        setTestPushResult('Reset complete — try sending a test now')
      } else {
        setPushError('Failed to create a new subscription after reset.')
      }
    } finally {
      setPushLoading(false)
    }
  }

  const handleTestPush = async () => {
    setTestPushLoading(true)
    setTestPushResult(null)
    try {
      const result = await sendTestPush()
      setTestPushResult(`Sent to ${result.sent}/${result.total} subscription${result.total !== 1 ? 's' : ''}`)
    } catch {
      setTestPushResult('Failed — check that pywebpush is installed')
    }
    setTestPushLoading(false)
  }

  const handlePushToggle = async () => {
    setPushLoading(true)
    setPushError(null)
    try {
      if (pushEnabled) {
        const sub = await getCurrentSubscription()
        if (sub) {
          await removeSubscription(sub.endpoint)
          await unsubscribeFromPush()
        }
        setPushEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setPushError('Notification permission denied. Allow it in browser settings.')
          return
        }
        const vapidKey = await getVapidPublicKey()
        if (!vapidKey) {
          setPushError('Backend VAPID key not available. Is pywebpush installed?')
          return
        }
        const sub = await subscribeToPush(vapidKey)
        if (sub) {
          await saveSubscription(sub)
          setPushEnabled(true)
        } else {
          setPushError(
            window.navigator.userAgent.includes('Brave') || window.navigator.brave !== undefined
              ? 'Brave blocks Google Push Messaging by default. Go to brave://settings/privacy → enable "Use Google services for push messaging" → reload and try again.'
              : window.navigator.userAgent.includes('Safari') && !window.navigator.userAgent.includes('Chrome')
                ? 'Safari requires HTTPS for push notifications. Try Chrome instead.'
                : 'Push service error — fcm.googleapis.com may be blocked. Check browser privacy/shield settings.'
          )
        }
      }
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-bg-primary border border-border rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <>
              <section className="mb-6">
                <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">LLM Provider</h3>
                <div className="space-y-2 bg-bg-secondary rounded-lg border border-border p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Provider</span>
                    <span className="text-text-primary">{settings?.llm_provider}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Model</span>
                    <span className="text-text-primary">{settings?.llm_model}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Status</span>
                    <div className="flex items-center gap-2">
                      {health === null ? (
                        <Spinner />
                      ) : (
                        <span className={health.healthy ? 'text-success' : 'text-danger'}>
                          {health.healthy ? 'Connected' : 'Unavailable'}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={checkHealth}>
                        Check
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Configure via environment variables (LLM_PROVIDER, LLM_MODEL, etc.)
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Google Calendar</h3>
                <div className="space-y-2 bg-bg-secondary rounded-lg border border-border p-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Status</span>
                    <span className={gcalStatus?.connected ? 'text-success' : 'text-text-muted'}>
                      {gcalStatus?.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  {gcalStatus?.connected && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Calendar</span>
                        <span className="text-text-primary">{gcalStatus.calendar_id}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Last sync</span>
                        <span className="text-text-primary">
                          {gcalStatus.last_sync_at
                            ? new Date(gcalStatus.last_sync_at).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    {gcalStatus?.connected ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGoogleSync}
                          disabled={syncing}
                        >
                          {syncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleGoogleDisconnect}>
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={handleGoogleConnect}>
                        Connect Google Calendar
                      </Button>
                    )}
                  </div>
                  {syncResult && (
                    <p className="text-xs text-text-muted mt-1">{syncResult}</p>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable.
                </p>
              </section>

              {/* Push Notifications */}
              <section className="mb-6">
                <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Desktop Notifications</h3>
                <div className="bg-bg-secondary rounded-lg border border-border p-4">
                  {!pushSupported ? (
                    <p className="text-sm text-text-muted">Push notifications are not supported in this browser.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-text-primary">
                            {pushEnabled ? 'Notifications enabled' : 'Enable desktop reminders'}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            Get notified before calendar events start
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePushToggle}
                          disabled={pushLoading}
                        >
                          {pushLoading ? <Spinner className="w-4 h-4" /> : pushEnabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                      {pushEnabled && (
                        <div className="flex flex-col gap-2 pt-1 border-t border-border">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleTestPush}
                              disabled={testPushLoading || pushLoading}
                            >
                              {testPushLoading ? <Spinner className="w-4 h-4" /> : 'Send test'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleResetPush}
                              disabled={pushLoading || testPushLoading}
                            >
                              {pushLoading ? <Spinner className="w-4 h-4" /> : 'Reset & resubscribe'}
                            </Button>
                            {testPushResult && (
                              <span className="text-xs text-text-muted">{testPushResult}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {pushError && (
                  <p className="text-xs text-danger mt-2 leading-relaxed">{pushError}</p>
                )}
              </section>

              {/* Memory section */}
              <section className="mb-6">
                <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Alfred's Memory</h3>
                {memories.length === 0 ? (
                  <div className="bg-bg-secondary rounded-lg border border-border p-4">
                    <p className="text-sm text-text-muted text-center py-2">
                      No memories yet. Alfred will remember things as you chat.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-start gap-2 bg-bg-secondary rounded-lg border border-border px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary leading-snug">{mem.content}</p>
                          {mem.category && (
                            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                              {CATEGORY_LABELS[mem.category] ?? mem.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          disabled={deletingId === mem.id}
                          className="shrink-0 mt-0.5 p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                          title="Forget this"
                        >
                          {deletingId === mem.id ? (
                            <Spinner className="w-3.5 h-3.5" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                              <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-text-muted mt-2">
                  Tell Alfred "remember that..." or "forget that you know..." to manage memories.
                </p>
              </section>

              <section>
                <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Preferences</h3>
                <div className="space-y-2 bg-bg-secondary rounded-lg border border-border p-4">
                  {settings &&
                    Object.entries(settings)
                      .filter(([k]) => !k.startsWith('llm'))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-text-muted">{key.replace(/_/g, ' ')}</span>
                          <span className="text-text-primary">{String(value)}</span>
                        </div>
                      ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
