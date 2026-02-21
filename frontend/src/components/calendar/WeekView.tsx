import { useState, useEffect, useCallback } from 'react'
import { getWeekStart, getWeekDays, toISODate } from '@/utils/calendar'
import { getWeekBlocks, triggerSchedule, deleteBlock, toggleBlockLock } from '@/api/calendar'
import type { CalendarBlock } from '@/types/calendar'
import HourLabels from './HourLabels'
import DayColumn from './DayColumn'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

const WORK_START = 7
const WORK_END = 22

export default function WeekView() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart())
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [unschedulableCount, setUnschedulableCount] = useState(0)

  const weekDays = getWeekDays(weekStart)
  const weekStartStr = toISODate(weekStart)
  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  const fetchBlocks = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await getWeekBlocks(weekStartStr)
      setBlocks(resp.blocks)
      setUnschedulableCount(resp.tasks_unschedulable)
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }, [weekStartStr])

  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

  const handleSchedule = async (force: boolean = false) => {
    setScheduling(true)
    try {
      const resp = await triggerSchedule({
        week_start: weekStartStr,
        force_reschedule: force,
      })
      setBlocks(resp.blocks)
      setUnschedulableCount(resp.tasks_unschedulable)
    } catch {
      // ignore
    } finally {
      setScheduling(false)
    }
  }

  const handleDelete = async (blockId: string) => {
    try {
      await deleteBlock(blockId)
      setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    } catch {
      // ignore
    }
  }

  const handleLockToggle = async (blockId: string) => {
    try {
      const updated = await toggleBlockLock(blockId)
      setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch {
      // ignore
    }
  }

  const navigateWeek = (delta: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta * 7)
    setWeekStart(next)
  }

  const goToToday = () => setWeekStart(getWeekStart())

  // Group blocks by date
  const blocksByDate = new Map<string, CalendarBlock[]>()
  for (const block of blocks) {
    const key = block.scheduled_date
    if (!blocksByDate.has(key)) blocksByDate.set(key, [])
    blocksByDate.get(key)!.push(block)
  }

  // Format week range for header
  const formatHeaderDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">Calendar</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateWeek(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-secondary transition-colors text-sm"
            >
              ‹
            </button>
            <span className="text-xs text-text-secondary min-w-[140px] text-center">
              {formatHeaderDate(weekDays[0])} — {formatHeaderDate(weekDays[6])}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-secondary transition-colors text-sm"
            >
              ›
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {scheduling && <Spinner className="w-4 h-4" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSchedule(true)}
            disabled={scheduling}
          >
            Reschedule
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSchedule(false)}
            disabled={scheduling}
          >
            {scheduling ? 'Scheduling...' : 'Schedule Week'}
          </Button>
        </div>
      </div>

      {/* Unschedulable warning */}
      {unschedulableCount > 0 && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 text-xs text-warning">
          {unschedulableCount} task{unschedulableCount > 1 ? 's' : ''} could not fit
          into this week's schedule.
        </div>
      )}

      {/* Calendar grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid min-h-full" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Hour labels column */}
            <div className="border-r border-border">
              {/* Empty header cell */}
              <div className="h-[52px] border-b border-border" />
              <HourLabels workStartHour={WORK_START} workEndHour={WORK_END} />
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dateKey = toISODate(day)
              const dayBlocks = blocksByDate.get(dateKey) || []
              return (
                <div key={dateKey} className="border-r border-border/30 last:border-r-0">
                  <DayColumn
                    date={day}
                    blocks={dayBlocks}
                    workStartHour={WORK_START}
                    workEndHour={WORK_END}
                    onLockToggle={handleLockToggle}
                    onDelete={handleDelete}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
