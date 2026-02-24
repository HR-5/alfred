import { cn } from '@/utils/cn'
import { priorityBlockColors } from '@/utils/calendar'
import { formatTime } from '@/utils/date'
import type { CalendarBlock } from '@/types/calendar'

interface Props {
  block: CalendarBlock
  top: number
  height: number
  onLockToggle?: (blockId: string) => void
  onDelete?: (blockId: string) => void
  onClick?: (block: CalendarBlock) => void
}

export default function TimeBlock({
  block,
  top,
  height,
  onLockToggle,
  onDelete,
  onClick,
}: Props) {
  const colors = priorityBlockColors(block.task_priority)
  const isCompact = height < 36

  return (
    <div
      className={cn(
        'absolute left-1 right-1 rounded overflow-hidden cursor-pointer group',
        'border-l-[3px] transition-shadow hover:shadow-lg hover:shadow-black/30',
        colors.bg,
        colors.border,
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
      onClick={() => onClick?.(block)}
    >
      <div className={cn('px-1.5', isCompact ? 'py-px flex items-center gap-1.5' : 'py-1')}>
        <p
          className={cn(
            'font-semibold truncate leading-tight',
            colors.text,
            isCompact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          {block.task_title}
        </p>
        {!isCompact && (
          <p className="text-[10px] text-text-secondary leading-tight mt-px">
            {formatTime(block.start_time)} – {formatTime(block.end_time)}
          </p>
        )}
      </div>

      {/* Lock indicator */}
      {block.is_locked && (
        <div className="absolute top-0.5 right-0.5 text-[8px] text-text-muted opacity-60">
          🔒
        </div>
      )}

      {/* Hover toolbar */}
      <div className="absolute top-0 right-0 hidden group-hover:flex items-center gap-px p-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onLockToggle?.(block.id)
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-[9px] bg-bg-primary/80 hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
          title={block.is_locked ? 'Unlock' : 'Lock'}
        >
          {block.is_locked ? '🔓' : '🔒'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(block.id)
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-[9px] bg-bg-primary/80 hover:bg-danger/40 text-text-muted hover:text-danger transition-colors"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
