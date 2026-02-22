import { formatHourLabel } from '@/utils/calendar'

interface Props {
  workStartHour: number
  workEndHour: number
  hourHeight: number
}

/**
 * Google Calendar-style hour labels.
 * Each label is positioned so text sits exactly on the grid line
 * (centered vertically on the boundary between rows).
 * The first line (top of grid) has no label.
 */
export default function HourLabels({ workStartHour, workEndHour, hourHeight }: Props) {
  const totalHours = workEndHour - workStartHour

  // Labels go at each hour boundary AFTER the first (1..totalHours-1),
  // plus we need the total height to match day columns
  const labels = Array.from({ length: totalHours - 1 }, (_, i) => workStartHour + i + 1)

  return (
    <div className="relative" style={{ height: totalHours * hourHeight }}>
      {labels.map((hour) => (
        <span
          key={hour}
          className="absolute right-2 text-[10px] text-text-muted leading-none -translate-y-1/2"
          style={{ top: (hour - workStartHour) * hourHeight }}
        >
          {formatHourLabel(hour)}
        </span>
      ))}
    </div>
  )
}
