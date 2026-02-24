import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/types/task'
import { getTasks, completeTask } from '@/api/tasks'
import { on, REFRESH_TASKS } from '@/utils/events'
import TaskCard from './TaskCard'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

type Filter = 'pending' | 'all' | 'todo' | 'done'

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

export default function TaskListView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
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
      setTotal(resp.total)
    } catch {
      // silently fail, user can retry
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

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const grouped = groupTasksByDate(tasks)

  const filters: { key: Filter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'todo', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'done', label: 'Done' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Tasks</h2>
          <p className="text-xs text-text-muted">{total} total</p>
        </div>
        <div className="flex gap-1">
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
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">No tasks found.</p>
            <p className="text-text-muted text-xs mt-1">Use the chat to add tasks.</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, dateTasks]) => {
            const isCollapsed = collapsedDates.has(dateKey)
            return (
              <div key={dateKey} className="mb-2">
                <button
                  onClick={() => toggleDateCollapse(dateKey)}
                  className="w-full flex items-center gap-2 py-2 px-1 text-left group"
                >
                  <svg
                    className={cn(
                      'w-3 h-3 text-text-muted transition-transform',
                      !isCollapsed && 'rotate-90',
                    )}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6 4l8 6-8 6V4z" />
                  </svg>
                  <span className="text-xs font-medium text-text-secondary">
                    {formatGroupDate(dateKey)}
                  </span>
                  <span className="text-xs text-text-muted">({dateTasks.length})</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {dateTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onComplete={handleComplete} />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
