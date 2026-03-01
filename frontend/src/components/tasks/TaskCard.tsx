import type { Task, TaskNote } from '@/types/task'
import Badge from '@/components/ui/Badge'
import { formatDate, formatTime } from '@/utils/date'
import { cn } from '@/utils/cn'

interface Props {
  task: Task
  onComplete?: (id: string) => void
  onDelete?: (id: string) => void
}

export default function TaskCard({ task, onComplete, onDelete }: Props) {
  const isDone = task.status === 'done'

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-secondary',
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

        {task.notes && task.notes.length > 0 && (
          <div className="mt-2 space-y-1">
            {task.notes.map((note: TaskNote) => (
              <p key={note.id} className="text-xs text-text-muted leading-snug pl-1 border-l-2 border-border">
                {note.content}
              </p>
            ))}
          </div>
        )}
      </div>

      {onDelete && (
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
          title="Delete task"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  )
}
