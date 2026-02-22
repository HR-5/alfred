import { useState, useEffect } from 'react'
import client from '@/api/client'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
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
