/**
 * Get the Monday of the week containing the given date.
 */
export function getWeekStart(d: Date = new Date()): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Get array of 7 dates for a week starting on Monday.
 */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/**
 * Format date as YYYY-MM-DD for API calls.
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse "HH:MM:SS" or "HH:MM" to fractional hours (e.g. "09:30" -> 9.5).
 */
export function timeToHours(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h + m / 60
}

/**
 * Calculate top offset (%) and height (%) for a block within the day column.
 */
export function blockPosition(
  startTime: string,
  endTime: string,
  workStartHour: number,
  workEndHour: number,
): { topPercent: number; heightPercent: number } {
  const totalHours = workEndHour - workStartHour
  const startH = timeToHours(startTime)
  const endH = timeToHours(endTime)
  const topPercent = ((startH - workStartHour) / totalHours) * 100
  const heightPercent = ((endH - startH) / totalHours) * 100
  return { topPercent, heightPercent }
}

/**
 * Map priority to Batman-themed color classes.
 */
export function priorityBlockColors(priority: string): {
  bg: string
  border: string
  text: string
} {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    critical: { bg: 'bg-critical/25', border: 'border-l-critical', text: 'text-red-300' },
    high: { bg: 'bg-danger/20', border: 'border-l-danger', text: 'text-red-400' },
    medium: { bg: 'bg-accent/20', border: 'border-l-accent', text: 'text-accent' },
    low: { bg: 'bg-success/20', border: 'border-l-success', text: 'text-green-400' },
    none: { bg: 'bg-bg-tertiary', border: 'border-l-border-light', text: 'text-text-secondary' },
  }
  return colors[priority] || colors.none
}

/**
 * Short day name for column headers.
 */
export function shortDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

/**
 * Format hour for row labels: "9 AM", "2 PM", etc.
 */
export function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  return `${h} ${ampm}`
}

/**
 * Check if two dates are the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
