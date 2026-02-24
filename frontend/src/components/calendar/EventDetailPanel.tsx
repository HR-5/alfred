import { useState, useEffect, useRef } from 'react'
import { cn } from '@/utils/cn'
import { formatDate, formatTime, formatTimestamp } from '@/utils/date'
import { priorityBlockColors } from '@/utils/calendar'
import { getBlockDetail, addBlockNote, tagTask, untagTask, deleteBlock, updateBlock } from '@/api/calendar'
import { getTasks } from '@/api/tasks'
import type { CalendarBlock } from '@/types/calendar'
import type { Task } from '@/types/task'

interface Props {
  block: CalendarBlock
  onClose: () => void
  onChatAbout: (block: CalendarBlock) => void
  onDeleted: () => void
}

export default function EventDetailPanel({ block, onClose, onChatAbout, onDeleted }: Props) {
  const [detail, setDetail] = useState<CalendarBlock>(block)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showTagSearch, setShowTagSearch] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Task[]>([])
  const [searching, setSearching] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const notesEndRef = useRef<HTMLDivElement>(null)

  const colors = priorityBlockColors(detail.task_priority)

  useEffect(() => {
    getBlockDetail(block.id).then(setDetail).catch(() => {})
  }, [block.id])

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail.notes?.length])

  // Tag search with debounce
  useEffect(() => {
    if (!tagQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const resp = await getTasks({ q: tagQuery, status: ['todo', 'in_progress'] })
        // Filter out already-tagged tasks and the primary task
        const taggedIds = new Set((detail.tagged_tasks ?? []).map((t) => t.id))
        if (detail.task_id) taggedIds.add(detail.task_id)
        setSearchResults(resp.tasks.filter((t) => !taggedIds.has(t.id)))
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [tagQuery, detail.tagged_tasks, detail.task_id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    try {
      const note = await addBlockNote(block.id, noteText.trim())
      setDetail((prev) => ({
        ...prev,
        notes: [...(prev.notes ?? []), note],
      }))
      setNoteText('')
    } catch {
      // ignore
    }
    setAddingNote(false)
  }

  const handleTagTask = async (taskId: string) => {
    try {
      await tagTask(block.id, taskId)
      const refreshed = await getBlockDetail(block.id)
      setDetail(refreshed)
      setTagQuery('')
      setShowTagSearch(false)
    } catch {
      // ignore
    }
  }

  const handleUntagTask = async (taskId: string) => {
    try {
      await untagTask(block.id, taskId)
      setDetail((prev) => ({
        ...prev,
        tagged_tasks: (prev.tagged_tasks ?? []).filter((t) => t.id !== taskId),
      }))
    } catch {
      // ignore
    }
  }

  const handleDelete = async () => {
    try {
      await deleteBlock(block.id)
      onDeleted()
    } catch {
      // ignore
    }
  }

  const handleTitleSave = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === detail.task_title) {
      setEditingTitle(false)
      return
    }
    try {
      await updateBlock(block.id, { title: trimmed })
      setDetail((prev) => ({ ...prev, task_title: trimmed, title: trimmed }))
    } catch {
      // ignore
    }
    setEditingTitle(false)
  }

  const startTitleEdit = () => {
    setTitleDraft(detail.task_title)
    setEditingTitle(true)
  }

  const priorityBadge = (priority: string) => {
    const cls: Record<string, string> = {
      critical: 'bg-critical/30 text-red-300',
      high: 'bg-danger/30 text-red-400',
      medium: 'bg-accent/30 text-accent',
      low: 'bg-success/30 text-green-400',
      none: 'bg-bg-tertiary text-text-muted',
    }
    return cls[priority] || cls.none
  }

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      todo: 'bg-bg-tertiary text-text-muted',
      in_progress: 'bg-accent/30 text-accent',
      done: 'bg-success/30 text-green-400',
      cancelled: 'bg-danger/30 text-red-400',
    }
    return cls[status] || cls.todo
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary border-l border-border">
      {/* Header */}
      <div className={cn('px-4 py-3 border-b border-border', colors.bg)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                className="w-full text-sm font-semibold bg-bg-primary/50 border border-accent/50 rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:border-accent"
                autoFocus
              />
            ) : (
              <h3
                className={cn('text-sm font-semibold truncate cursor-pointer hover:opacity-80', colors.text)}
                onClick={startTitleEdit}
                title="Click to edit title"
              >
                {detail.task_title}
              </h3>
            )}
            <p className="text-xs text-text-muted mt-0.5">
              {formatDate(detail.scheduled_date)} &middot; {formatTime(detail.start_time)} &ndash; {formatTime(detail.end_time)}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {detail.duration_minutes}min &middot; {detail.source === 'google_calendar' ? 'Google Calendar' : 'Alfred'}
              {detail.is_locked && ' \u00B7 Locked'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-primary/50 text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tagged Tasks */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Tagged Tasks</h4>
            <button
              onClick={() => setShowTagSearch(!showTagSearch)}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              {showTagSearch ? 'Cancel' : '+ Tag'}
            </button>
          </div>

          {/* Primary task */}
          {detail.task_id && (
            <div className="flex items-center gap-1.5 py-1">
              <span className={cn('px-1.5 py-px rounded text-[9px] font-medium', priorityBadge(detail.task_priority))}>
                {detail.task_priority}
              </span>
              <span className="text-xs text-text-primary truncate flex-1">{detail.task_title}</span>
              <span className={cn('px-1.5 py-px rounded text-[9px]', statusBadge(detail.task_status))}>
                {detail.task_status.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Additional tagged tasks */}
          {(detail.tagged_tasks ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 py-1 group">
              <span className={cn('px-1.5 py-px rounded text-[9px] font-medium', priorityBadge(t.priority))}>
                {t.priority}
              </span>
              <span className="text-xs text-text-primary truncate flex-1">{t.title}</span>
              <span className={cn('px-1.5 py-px rounded text-[9px]', statusBadge(t.status))}>
                {t.status.replace('_', ' ')}
              </span>
              <button
                onClick={() => handleUntagTask(t.id)}
                className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-[9px] text-text-muted hover:text-danger transition-colors"
                title="Remove tag"
              >
                &times;
              </button>
            </div>
          ))}

          {!detail.task_id && (detail.tagged_tasks ?? []).length === 0 && (
            <p className="text-xs text-text-muted italic">No tasks tagged</p>
          )}

          {/* Tag search */}
          {showTagSearch && (
            <div className="mt-2">
              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Search tasks to tag..."
                className="w-full px-2 py-1.5 text-xs bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              {searching && <p className="text-[10px] text-text-muted mt-1">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-bg-secondary">
                  {searchResults.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTagTask(task.id)}
                      className="w-full px-2 py-1.5 text-left text-xs text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-1.5"
                    >
                      <span className={cn('px-1 py-px rounded text-[9px]', priorityBadge(task.priority))}>
                        {task.priority}
                      </span>
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="px-4 py-3">
          <h4 className="text-[10px] font-medium text-text-secondary uppercase tracking-wider mb-2">Notes</h4>

          {(detail.notes ?? []).length === 0 && (
            <p className="text-xs text-text-muted italic mb-2">No notes yet</p>
          )}

          <div className="space-y-2">
            {(detail.notes ?? []).map((note) => (
              <div key={note.id} className="bg-bg-secondary rounded px-3 py-2 border border-border">
                <p className="text-xs text-text-primary whitespace-pre-wrap">{note.content}</p>
                <p className="text-[10px] text-text-muted mt-1">
                  {note.source} &middot; {formatTimestamp(note.created_at)}
                </p>
              </div>
            ))}
            <div ref={notesEndRef} />
          </div>
        </div>
      </div>

      {/* Note input + actions */}
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="Add a note..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !noteText.trim()}
            className="px-2.5 py-1.5 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onChatAbout(detail)}
            className="flex-1 px-2 py-1.5 text-[10px] text-text-muted bg-bg-secondary border border-border rounded hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            Chat about this
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1.5 text-[10px] text-danger bg-bg-secondary border border-border rounded hover:bg-danger/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
