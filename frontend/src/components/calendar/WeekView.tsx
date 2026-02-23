import { useState, useEffect, useCallback, useRef } from 'react'
import { getWeekStart, getWeekDays, toISODate } from '@/utils/calendar'
import { getWeekBlocks, triggerSchedule, deleteBlock, toggleBlockLock } from '@/api/calendar'
import { syncGoogle, getGoogleStatus } from '@/api/integrations'
import type { CalendarBlock } from '@/types/calendar'
import HourLabels from './HourLabels'
import DayColumn from './DayColumn'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { isSameDay, shortDayName } from '@/utils/calendar'

/** Pixels per hour row — consistent across labels + day columns */
export const HOUR_HEIGHT = 48

const WORK_START = 0
const WORK_END = 24

interface Props {
  onBlockClick?: (block: CalendarBlock) => void
}

export default function WeekView({ onBlockClick }: Props = {}) {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart())
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [unschedulableCount, setUnschedulableCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const didScroll = useRef(false)

  const weekDays = getWeekDays(weekStart)
  const weekStartStr = toISODate(weekStart)

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

  // Check Google Calendar connection status
  useEffect(() => {
    getGoogleStatus()
      .then((s) => setGcalConnected(s.connected))
      .catch(() => {})
  }, [])

  // Periodic Google Calendar sync every 15 minutes
  useEffect(() => {
    if (!gcalConnected) return
    const interval = setInterval(async () => {
      try {
        await syncGoogle()
        fetchBlocks()
      } catch {
        // silent
      }
    }, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [gcalConnected, fetchBlocks])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncGoogle()
      await fetchBlocks()
    } catch {
      // ignore
    }
    setSyncing(false)
  }

  // Auto-scroll to current hour on first load
  useEffect(() => {
    if (!loading && scrollRef.current && !didScroll.current) {
      didScroll.current = true
      const now = new Date()
      const scrollToHour = Math.max(0, now.getHours() - 1)
      scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT
    }
  }, [loading])

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
    didScroll.current = false
  }

  const goToToday = () => {
    setWeekStart(getWeekStart())
    didScroll.current = false
  }

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

  const today = new Date()

  return (
    <div className="h-full flex flex-col">
      {/* Top toolbar */}
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">Calendar</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-hover text-text-secondary transition-colors text-sm"
            >
              ‹
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-hover text-text-secondary transition-colors text-sm"
            >
              ›
            </button>
          </div>
          <span className="text-sm text-text-primary font-medium">
            {formatHeaderDate(weekDays[0])} — {formatHeaderDate(weekDays[6])}
          </span>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {(scheduling || syncing) && <Spinner className="w-4 h-4" />}
          {gcalConnected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              title="Sync with Google Calendar"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
          )}
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

      {/* Calendar */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sticky day headers */}
          <div
            className="grid shrink-0 border-b border-border"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
          >
            {/* Gutter corner */}
            <div className="border-r border-border/50" />

            {/* Day headers */}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today)
              return (
                <div
                  key={toISODate(day)}
                  className={cn(
                    'text-center py-2 border-r border-border/20 last:border-r-0',
                  )}
                >
                  <p className={cn(
                    'text-[11px] uppercase tracking-wider font-medium',
                    isToday ? 'text-accent' : 'text-text-muted',
                  )}>
                    {shortDayName(day)}
                  </p>
                  <div className="flex justify-center mt-0.5">
                    <span
                      className={cn(
                        'text-lg leading-none font-medium',
                        isToday
                          ? 'text-bg-primary bg-accent w-8 h-8 rounded-full flex items-center justify-center'
                          : 'text-text-primary w-8 h-8 flex items-center justify-center',
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div
              className="grid"
              style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
            >
              {/* Hour labels gutter */}
              <div className="relative border-r border-border/50">
                <HourLabels
                  workStartHour={WORK_START}
                  workEndHour={WORK_END}
                  hourHeight={HOUR_HEIGHT}
                />
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dateKey = toISODate(day)
                const dayBlocks = blocksByDate.get(dateKey) || []
                const isToday = isSameDay(day, today)
                return (
                  <DayColumn
                    key={dateKey}
                    blocks={dayBlocks}
                    workStartHour={WORK_START}
                    workEndHour={WORK_END}
                    hourHeight={HOUR_HEIGHT}
                    isToday={isToday}
                    onLockToggle={handleLockToggle}
                    onDelete={handleDelete}
                    onBlockClick={onBlockClick}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
