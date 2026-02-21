import { formatHourLabel } from '@/utils/calendar'

interface Props {
  workStartHour: number
  workEndHour: number
}

export default function HourLabels({ workStartHour, workEndHour }: Props) {
  const hours = Array.from(
    { length: workEndHour - workStartHour },
    (_, i) => workStartHour + i,
  )

  return (
    <div className="relative">
      {hours.map((hour) => (
        <div key={hour} className="h-15 flex items-start justify-end pr-3 -mt-2">
          <span className="text-[10px] text-text-muted leading-none">
            {formatHourLabel(hour)}
          </span>
        </div>
      ))}
    </div>
  )
}
