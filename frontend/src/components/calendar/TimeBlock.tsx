import { cn } from '@/utils/cn'
import { priorityBlockColors } from '@/utils/calendar'
import { formatTime } from '@/utils/date'
import type { CalendarBlock } from '@/types/calendar'

interface Props {
  block: CalendarBlock
  topPercent: number
  heightPercent: number
  onLockToggle?: (blockId: string) => void
  onDelete?: (blockId: string) => void
}

export default function TimeBlock({
  block,
  topPercent,
  heightPercent,
  onLockToggle,
  onDelete,
}: Props) {
  const colors = priorityBlockColors(block.task_priority)
  const isCompact = heightPercent < 8

  return (
    <div
      className={cn(
        'absolute left-1 right-1 rounded-md border-l-4 overflow-hidden cursor-pointer group transition-all hover:brightness-125',
        colors.bg,
        colors.border,
      )}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        minHeight: '22px',
      }}
    >
      <div className={cn('px-2', isCompact ? 'py-0.5 flex items-center gap-2' : 'py-1.5')}>
        <p className={cn('font-medium truncate', colors.text, isCompact ? 'text-[10px]' : 'text-xs')}>
          {block.task_title}
        </p>
        {!isCompact && (
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatTime(block.start_time)} - {formatTime(block.end_time)}
          </p>
        )}
      </div>

      {/* Lock indicator */}
      {block.is_locked && (
        <div className="absolute top-1 right-1 text-[9px] text-text-muted">
          🔒
        </div>
      )}

      {/* Hover toolbar */}
      <div className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onLockToggle?.(block.id)
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] bg-bg-primary/60 hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
          title={block.is_locked ? 'Unlock' : 'Lock'}
        >
          {block.is_locked ? '🔓' : '🔒'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(block.id)
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] bg-bg-primary/60 hover:bg-danger/30 text-text-muted hover:text-danger transition-colors"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
