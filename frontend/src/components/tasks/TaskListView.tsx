import { useState, useEffect } from 'react'
import type { Task } from '@/types/task'
import { getTasks, completeTask } from '@/api/tasks'
import TaskCard from './TaskCard'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

type Filter = 'all' | 'todo' | 'done' | 'overdue'

export default function TaskListView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const statusMap: Record<Filter, string[] | undefined> = {
        all: undefined,
        todo: ['todo', 'in_progress', 'snoozed'],
        done: ['done'],
        overdue: ['todo'],
      }
      const resp = await getTasks({ status: statusMap[filter] })
      setTasks(resp.tasks)
      setTotal(resp.total)
    } catch {
      // silently fail, user can retry
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

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'todo', label: 'Active' },
    { key: 'done', label: 'Done' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Tasks</h2>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={handleComplete} />
          ))
        )}
      </div>
    </div>
  )
}
