import { cn } from '@/utils/cn'
import type { Priority, TaskStatus } from '@/types/task'

const priorityColors: Record<Priority, string> = {
  critical: 'bg-critical/15 text-critical border-critical/30',
  high: 'bg-danger/15 text-danger border-danger/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  low: 'bg-accent/15 text-accent border-accent/30',
  none: 'bg-bg-tertiary text-text-muted border-border',
}

const statusColors: Record<TaskStatus, string> = {
  todo: 'bg-bg-tertiary text-text-secondary border-border',
  in_progress: 'bg-accent/15 text-accent border-accent/30',
  done: 'bg-success/15 text-success border-success/30',
  snoozed: 'bg-warning/15 text-warning border-warning/30',
  cancelled: 'bg-bg-tertiary text-text-muted border-border line-through',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'priority' | 'status'
  value?: string
  className?: string
}

export default function Badge({ children, variant, value, className }: BadgeProps) {
  let colorClass = 'bg-bg-tertiary text-text-secondary border-border'
  if (variant === 'priority' && value) {
    colorClass = priorityColors[value as Priority] || colorClass
  } else if (variant === 'status' && value) {
    colorClass = statusColors[value as TaskStatus] || colorClass
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border',
        colorClass,
        className
      )}
    >
      {children}
    </span>
  )
}
