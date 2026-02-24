import type { Task } from '@/types/task'
import Badge from '@/components/ui/Badge'
import { formatDate, formatTime } from '@/utils/date'
import { cn } from '@/utils/cn'

interface Props {
  task: Task
  onComplete?: (id: string) => void
}

export default function TaskCard({ task, onComplete }: Props) {
  const isDone = task.status === 'done'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-secondary',
        'hover:border-border-light transition-colors',
        isDone && 'opacity-60'
      )}
    >
      <button
        onClick={() => onComplete?.(task.id)}
        disabled={isDone}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center',
          isDone
            ? 'bg-success border-success text-white'
            : 'border-border-light hover:border-accent'
        )}
      >
        {isDone && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', isDone && 'line-through text-text-muted')}>
          {task.title}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {task.priority !== 'none' && (
            <Badge variant="priority" value={task.priority}>
              {task.priority}
            </Badge>
          )}
          <Badge variant="status" value={task.status}>
            {task.status.replace('_', ' ')}
          </Badge>
          {task.due_date && (
            <span className="text-xs text-text-secondary">
              {formatDate(task.due_date)}
              {task.due_time && ` at ${formatTime(task.due_time)}`}
            </span>
          )}
          {task.estimated_minutes && (
            <span className="text-xs text-text-secondary">
              ~{task.estimated_minutes}m
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
