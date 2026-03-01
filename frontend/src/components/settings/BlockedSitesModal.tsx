import { useState, useEffect } from 'react'
import { getBlockedSites, createBlockedSite, deleteBlockedSite, type BlockedSite } from '@/api/blockedSites'
import Spinner from '@/components/ui/Spinner'

interface Props {
  onClose: () => void
}

function normalizePattern(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export default function BlockedSitesModal({ onClose }: Props) {
  const [sites, setSites] = useState<BlockedSite[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBlockedSites()
      .then(setSites)
      .catch(() => setError('Could not load blocked sites.'))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    const trimmedName = name.trim()
    const normalizedPattern = normalizePattern(pattern)
    if (!trimmedName || !normalizedPattern) {
      setError('Both name and domain are required.')
      return
    }
    setError(null)
    setAdding(true)
    try {
      const site = await createBlockedSite(trimmedName, normalizedPattern)
      setSites((prev) => [...prev, site])
      setName('')
      setPattern('')
    } catch {
      setError('Failed to add site. Please try again.')
    }
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteBlockedSite(id)
      setSites((prev) => prev.filter((s) => s.id !== id))
    } catch {
      setError('Failed to remove site.')
    }
    setDeletingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-bg-primary border border-border rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h2 className="text-sm font-semibold text-text-primary">Blocked Sites</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Site list */}
              <div className="space-y-2">
                {sites.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">
                    No sites blocked yet. Add a domain like <span className="text-text-secondary font-mono">reddit.com</span> to get started.
                  </p>
                ) : (
                  sites.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-bg-secondary rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-red-500/70 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{site.name}</p>
                          <p className="text-xs text-text-muted font-mono truncate">{site.pattern}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(site.id)}
                        disabled={deletingId === site.id}
                        className="ml-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-muted hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
                        title="Remove"
                      >
                        {deletingId === site.id ? (
                          <Spinner />
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6" />
                            <path d="M19,6l-1,14H6L5,6" />
                            <path d="M10,11v6M14,11v6" />
                            <path d="M9,6V4h6v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add form */}
              <div className="border-t border-border pt-4 space-y-2.5">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Add a site</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Display name (e.g. YouTube)"
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Domain (e.g. youtube.com)"
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
                />
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  onClick={handleAdd}
                  disabled={adding || !name.trim() || !pattern.trim()}
                  className="w-full py-2 bg-accent text-bg-primary text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adding ? 'Adding…' : 'Block site'}
                </button>
              </div>

              {/* Info note */}
              <p className="text-xs text-text-muted leading-relaxed border-t border-border pt-3">
                Alfred will intercept any navigation to these domains and require you to argue your case before granting access. Install the <span className="text-text-secondary">Alfred Blocker</span> Chrome extension to activate.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
