import { useState, useEffect } from 'react'

interface Props {
  workStartHour: number
  workEndHour: number
  hourHeight: number
}

export default function CurrentTimeLine({ workStartHour, workEndHour, hourHeight }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const currentHour = now.getHours() + now.getMinutes() / 60

  if (currentHour < workStartHour || currentHour > workEndHour) return null

  const top = (currentHour - workStartHour) * hourHeight

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-accent -ml-1.5 shrink-0" />
        <div className="flex-1 h-[2px] bg-accent" />
      </div>
    </div>
  )
}
