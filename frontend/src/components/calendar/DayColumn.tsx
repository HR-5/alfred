import { cn } from '@/utils/cn'
import type { CalendarBlock } from '@/types/calendar'
import TimeBlock from './TimeBlock'
import CurrentTimeLine from './CurrentTimeLine'

interface Props {
  blocks: CalendarBlock[]
  workStartHour: number
  workEndHour: number
  hourHeight: number
  isToday: boolean
  onLockToggle: (blockId: string) => void
  onDelete: (blockId: string) => void
  onBlockClick?: (block: CalendarBlock) => void
}

export default function DayColumn({
  blocks,
  workStartHour,
  workEndHour,
  hourHeight,
  isToday,
  onLockToggle,
  onDelete,
  onBlockClick,
}: Props) {
  const totalHours = workEndHour - workStartHour
  const totalHeight = totalHours * hourHeight

  return (
    <div
      className={cn(
        'relative border-r border-border/20 last:border-r-0',
        isToday && 'bg-accent/[0.03]',
      )}
      style={{ height: totalHeight }}
    >
      {/* Hour grid lines — top border for each hour after the first */}
      {Array.from({ length: totalHours - 1 }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/20"
          style={{ top: (i + 1) * hourHeight }}
        />
      ))}

      {/* Half-hour dashed lines */}
      {Array.from({ length: totalHours }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-border/10"
          style={{ top: i * hourHeight + hourHeight / 2 }}
        />
      ))}

      {/* Current time line */}
      {isToday && (
        <CurrentTimeLine
          workStartHour={workStartHour}
          workEndHour={workEndHour}
          hourHeight={hourHeight}
        />
      )}

      {/* Task blocks */}
      {blocks.map((block) => {
        const startH = timeToHours(block.start_time)
        let endH = timeToHours(block.end_time)
        // Cross-midnight: end_time wraps to next day (e.g. 00:30 < 22:30)
        if (endH <= startH) endH = workEndHour
        const top = (startH - workStartHour) * hourHeight
        const height = (endH - startH) * hourHeight
        return (
          <TimeBlock
            key={block.id}
            block={block}
            top={top}
            height={Math.max(height, 20)}
            onLockToggle={onLockToggle}
            onDelete={onDelete}
            onClick={onBlockClick}
          />
        )
      })}
    </div>
  )
}

function timeToHours(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h + m / 60
}
