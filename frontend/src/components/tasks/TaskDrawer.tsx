import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '@/types/task'
import { getTasks, completeTask } from '@/api/tasks'
import TaskCard from './TaskCard'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

type Filter = 'all' | 'todo' | 'done'

const COLLAPSED_HEIGHT = 40
const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 260

export default function TaskDrawer() {
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('todo')
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const statusMap: Record<Filter, string[] | undefined> = {
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
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [filter])

  const handleComplete = async (taskId: string) => {
    try {
      await completeTask(taskId)
      fetchTasks()
    } catch {
      // ignore
    }
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
  const filters: { key: Filter; label: string }[] = [
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
          <span className="text-xs font-medium text-text-secondary">Tasks</span>
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
          className="overflow-y-auto px-3 pb-3 space-y-1.5"
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
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
