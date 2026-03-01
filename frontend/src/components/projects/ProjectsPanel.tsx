import { useState, useEffect, useCallback } from 'react'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectTasks,
  type Project,
  type ProjectTask,
} from '@/api/projects'
import Spinner from '@/components/ui/Spinner'

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  snoozed: 'Snoozed',
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'text-text-muted',
  in_progress: 'text-accent',
  done: 'text-success',
  cancelled: 'text-danger',
  snoozed: 'text-warning',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-danger/20 text-danger',
  high: 'bg-warning/20 text-warning',
  medium: 'bg-accent/20 text-accent',
  low: 'bg-text-muted/20 text-text-muted',
  none: 'bg-text-muted/10 text-text-muted',
}

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

interface Props {
  onClose: () => void
}

export default function ProjectsPanel({ onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Create project form
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)

  // Edit detail
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDirty, setEditDirty] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  const selectProject = useCallback(async (proj: Project) => {
    setSelected(proj)
    setEditTitle(proj.title)
    setEditDesc(proj.description ?? '')
    setEditNotes(proj.notes ?? '')
    setEditDirty(false)
    setTasksLoading(true)
    try {
      const t = await getProjectTasks(proj.id)
      setTasks(t)
    } finally {
      setTasksLoading(false)
    }
  }, [])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const proj = await createProject({ title: newTitle.trim(), color: newColor })
      setProjects((prev) => [proj, ...prev])
      setNewTitle('')
      setNewColor('#6366f1')
      setCreating(false)
      selectProject(proj)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDetail = async () => {
    if (!selected) return
    setEditSaving(true)
    try {
      const updated = await updateProject(selected.id, {
        title: editTitle,
        description: editDesc,
        notes: editNotes,
      })
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, task_count: p.task_count } : p)))
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev))
      setEditDirty(false)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete project "${selected.title}"? Tasks will not be deleted.`)) return
    setDeleting(true)
    try {
      await deleteProject(selected.id)
      setProjects((prev) => prev.filter((p) => p.id !== selected.id))
      setSelected(null)
      setTasks([])
    } finally {
      setDeleting(false)
    }
  }

  const handleColorChange = async (color: string) => {
    if (!selected) return
    const updated = await updateProject(selected.id, { color })
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, color } : p)))
    setSelected((prev) => (prev ? { ...prev, color } : prev))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-3xl mx-4 bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ height: 'min(80vh, 640px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Projects</h2>
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
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — project list */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border">
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                New Project
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="w-5 h-5" />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6 px-3">
                No projects yet. Create one to get started.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => selectProject(proj)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selected?.id === proj.id
                        ? 'bg-bg-hover text-text-primary'
                        : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="flex-1 text-sm truncate">{proj.title}</span>
                    <span className="text-xs text-text-muted shrink-0">{proj.task_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main — project detail or create form */}
          <div className="flex-1 overflow-y-auto">
            {creating ? (
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-medium text-text-primary">New Project</h3>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Title</label>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Project name..."
                    className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-2 ring-offset-bg-primary scale-110' : ''}`}
                        style={{ backgroundColor: c, ringColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newTitle.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-accent text-bg-primary hover:bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewTitle(''); }}
                    className="px-4 py-2 text-sm rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div className="p-5 space-y-5">
                {/* Title + color */}
                <div className="flex items-start gap-3">
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleColorChange(c)}
                          className={`w-5 h-5 rounded-full transition-transform ${selected.color === c ? 'ring-2 ring-offset-1 ring-offset-bg-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      value={editTitle}
                      onChange={(e) => { setEditTitle(e.target.value); setEditDirty(true) }}
                      className="text-lg font-semibold bg-transparent text-text-primary border-b border-transparent hover:border-border focus:border-accent focus:outline-none w-full transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="ml-auto shrink-0 p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                    title="Delete project"
                  >
                    {deleting ? <Spinner className="w-4 h-4" /> : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => { setEditDesc(e.target.value); setEditDirty(true) }}
                    rows={2}
                    placeholder="Short description..."
                    className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => { setEditNotes(e.target.value); setEditDirty(true) }}
                    rows={5}
                    placeholder="Project notes, goals, links..."
                    className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none font-mono"
                  />
                </div>

                {editDirty && (
                  <button
                    onClick={handleSaveDetail}
                    disabled={editSaving}
                    className="px-4 py-2 text-sm rounded-lg bg-accent text-bg-primary hover:bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}

                {/* Tasks */}
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                    Tasks ({tasks.length})
                  </h4>
                  {tasksLoading ? (
                    <div className="flex items-center gap-2 py-3">
                      <Spinner className="w-4 h-4" />
                      <span className="text-xs text-text-muted">Loading tasks...</span>
                    </div>
                  ) : tasks.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">
                      No tasks assigned. Ask Alfred to add tasks to this project.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded-lg border border-border"
                        >
                          <span className={`text-sm ${STATUS_COLORS[t.status] ?? 'text-text-muted'}`}>
                            {t.status === 'done' ? '✓' : t.status === 'cancelled' ? '✗' : '○'}
                          </span>
                          <span className="flex-1 text-sm text-text-primary truncate">{t.title}</span>
                          {t.priority !== 'none' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                              {t.priority.toUpperCase()}
                            </span>
                          )}
                          {t.due_date && (
                            <span className="text-xs text-text-muted shrink-0">{t.due_date}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-text-muted">
                Select a project or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
