import { cn } from '@/utils/cn'
import { blockPosition, shortDayName, isSameDay } from '@/utils/calendar'
import type { CalendarBlock } from '@/types/calendar'
import TimeBlock from './TimeBlock'
import CurrentTimeLine from './CurrentTimeLine'

interface Props {
  date: Date
  blocks: CalendarBlock[]
  workStartHour: number
  workEndHour: number
  onLockToggle: (blockId: string) => void
  onDelete: (blockId: string) => void
}

export default function DayColumn({
  date,
  blocks,
  workStartHour,
  workEndHour,
  onLockToggle,
  onDelete,
}: Props) {
  const today = new Date()
  const isToday = isSameDay(date, today)
  const hours = Array.from(
    { length: workEndHour - workStartHour },
    (_, i) => workStartHour + i,
  )

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        className={cn(
          'text-center py-2 border-b border-border sticky top-0 z-10',
          isToday ? 'bg-accent/5' : 'bg-bg-secondary',
        )}
      >
        <p className="text-[10px] text-text-muted uppercase tracking-wider">
          {shortDayName(date)}
        </p>
        <p
          className={cn(
            'text-sm font-semibold mt-0.5',
            isToday
              ? 'text-accent bg-accent/15 w-7 h-7 rounded-full flex items-center justify-center mx-auto'
              : 'text-text-primary',
          )}
        >
          {date.getDate()}
        </p>
      </div>

      {/* Time grid + blocks */}
      <div className="relative flex-1">
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className={cn('h-15 border-b border-border/30', isToday && 'bg-accent/[0.02]')}
          />
        ))}

        {/* Current time line */}
        {isToday && (
          <CurrentTimeLine workStartHour={workStartHour} workEndHour={workEndHour} />
        )}

        {/* Task blocks */}
        {blocks.map((block) => {
          const pos = blockPosition(
            block.start_time,
            block.end_time,
            workStartHour,
            workEndHour,
          )
          return (
            <TimeBlock
              key={block.id}
              block={block}
              topPercent={pos.topPercent}
              heightPercent={pos.heightPercent}
              onLockToggle={onLockToggle}
              onDelete={onDelete}
            />
          )
        })}
      </div>
    </div>
  )
}
