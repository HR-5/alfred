import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '@/types/task'
import { getTasks, completeTask, deleteTask } from '@/api/tasks'
import TaskCard from './TaskCard'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { on, REFRESH_TASKS } from '@/utils/events'

type Filter = 'pending' | 'all' | 'todo' | 'done'

const COLLAPSED_HEIGHT = 40
const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 360

function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = task.due_date ?? 'No due date'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(task)
  }
  // Sort tasks within each date group by due_time
  for (const [, dateTasks] of groups) {
    dateTasks.sort((a, b) => {
      if (!a.due_time && !b.due_time) return 0
      if (!a.due_time) return 1
      if (!b.due_time) return -1
      return a.due_time.localeCompare(b.due_time)
    })
  }
  return groups
}

function formatGroupDate(key: string): string {
  if (key === 'No due date') return 'No due date'
  const d = new Date(key + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TaskDrawer() {
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchTasks = async (preserveScroll = false) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    setLoading(true)
    try {
      const statusMap: Record<Filter, string[] | undefined> = {
        pending: ['todo'],
        all: undefined,
        todo: ['todo', 'in_progress', 'snoozed'],
        done: ['done'],
      }
      const resp = await getTasks({ status: statusMap[filter] })
      setTasks(resp.tasks)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      if (preserveScroll) {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollTop
        })
      }
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [filter])

  // Listen for refresh events from chat
  useEffect(() => {
    return on(REFRESH_TASKS, () => fetchTasks(true))
  }, [filter])

  const handleComplete = async (taskId: string) => {
    try {
      await completeTask(taskId)
      fetchTasks(true)
    } catch {
      // ignore
    }
  }

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      fetchTasks(true)
    } catch {
      // ignore
    }
  }

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  // Drag-to-resize logic
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !containerRef.current) return
      const parent = containerRef.current.parentElement
      if (!parent) return

      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const parentRect = parent.getBoundingClientRect()
      const maxHeight = parentRect.height * 0.7
      const newHeight = parentRect.bottom - clientY

      if (newHeight < COLLAPSED_HEIGHT + 20) {
        // Snap closed
        setOpen(false)
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        return
      }

      setHeight(Math.max(MIN_HEIGHT, Math.min(newHeight, maxHeight)))
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const activeCount = tasks.filter((t) => t.status !== 'done').length
  const grouped = groupTasksByDate(tasks)

  const filters: { key: Filter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'todo', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'done', label: 'Done' },
  ]

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-border bg-bg-secondary overflow-hidden"
      style={{ height: open ? height : COLLAPSED_HEIGHT }}
    >
      {/* Drag handle — visible when open */}
      {open && (
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          className="h-1.5 flex items-center justify-center cursor-ns-resize group hover:bg-accent/10 transition-colors"
        >
          <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-accent/50 transition-colors" />
        </div>
      )}

      {/* Header bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 hover:bg-bg-hover transition-colors"
        style={{ height: open ? COLLAPSED_HEIGHT - 6 : COLLAPSED_HEIGHT }}
      >
        <div className="flex items-center gap-2">
          <svg
            className={cn('w-3 h-3 text-text-muted transition-transform', open && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-semibold text-text-primary">Tasks</span>
          <span className="text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded-full">
            {activeCount} active
          </span>
        </div>

        {open && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {filters.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </button>

      {/* Drawer content */}
      {open && (
        <div
          ref={scrollRef}
          className="overflow-y-auto px-3 pb-3"
          style={{ height: `calc(100% - ${COLLAPSED_HEIGHT}px)` }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="h-5 w-5" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-text-muted text-xs">No tasks found.</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([dateKey, dateTasks]) => {
              const isCollapsed = collapsedDates.has(dateKey)
              return (
                <div key={dateKey} className="mb-1">
                  <button
                    onClick={() => toggleDateCollapse(dateKey)}
                    className="w-full flex items-center gap-1.5 py-1.5 px-1 text-left group"
                  >
                    <svg
                      className={cn(
                        'w-2.5 h-2.5 text-text-muted transition-transform',
                        !isCollapsed && 'rotate-90',
                      )}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6 4l8 6-8 6V4z" />
                    </svg>
                    <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                      {formatGroupDate(dateKey)}
                    </span>
                    <span className="text-[10px] text-text-muted">({dateTasks.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1.5 ml-1">
                      {dateTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onComplete={handleComplete} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
