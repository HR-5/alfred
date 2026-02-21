import { useState, useEffect } from 'react'
import client from '@/api/client'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [health, setHealth] = useState<{ healthy: boolean; provider: string; model: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/settings').then((r) => r.data),
      client.get('/settings/llm/health').then((r) => r.data).catch(() => null),
    ]).then(([s, h]) => {
      setSettings(s)
      setHealth(h)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-text-primary mb-6">Settings</h2>

      <section className="mb-8">
        <h3 className="text-sm font-medium text-text-secondary mb-3">LLM Provider</h3>
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
          Configure via environment variables (LLM_PROVIDER, LLM_MODEL, OLLAMA_BASE_URL, etc.)
        </p>
      </section>

      <section>
        <h3 className="text-sm font-medium text-text-secondary mb-3">Preferences</h3>
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
    </div>
  )
}
