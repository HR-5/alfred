import { useState, useEffect } from 'react'

interface Props {
  workStartHour: number
  workEndHour: number
}

export default function CurrentTimeLine({ workStartHour, workEndHour }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const currentHour = now.getHours() + now.getMinutes() / 60
  const totalHours = workEndHour - workStartHour

  // Only show if current time is within working hours
  if (currentHour < workStartHour || currentHour > workEndHour) return null

  const topPercent = ((currentHour - workStartHour) / totalHours) * 100

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${topPercent}%` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-accent -ml-1 shrink-0" />
        <div className="flex-1 h-px bg-accent/70" />
      </div>
    </div>
  )
}
