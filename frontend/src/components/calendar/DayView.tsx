import { useState, useEffect, useCallback, useRef } from 'react'
import { toISODate, isSameDay } from '@/utils/calendar'
import { getWeekBlocks, deleteBlock, toggleBlockLock } from '@/api/calendar'
import type { CalendarBlock } from '@/types/calendar'
import HourLabels from './HourLabels'
import DayColumn from './DayColumn'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { on, REFRESH_CALENDAR } from '@/utils/events'

const HOUR_HEIGHT = 48
const WORK_START = 0
const WORK_END = 24

interface Props {
  onBlockClick?: (block: CalendarBlock) => void
  onBlockDoubleClick?: (block: CalendarBlock) => void
}

export default function DayView({ onBlockClick, onBlockDoubleClick }: Props) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const didScroll = useRef(false)
  const savedScrollTop = useRef<number>(0)

  const dateStr = toISODate(currentDate)
  const today = new Date()
  const isToday = isSameDay(currentDate, today)

  // We fetch the week and filter to the current day (reuses existing API)
  const fetchBlocks = useCallback(async () => {
    // Save scroll position before reload
    if (scrollRef.current && didScroll.current) {
      savedScrollTop.current = scrollRef.current.scrollTop
    }
    setLoading(true)
    try {
      // Get week start for this date
      const d = new Date(currentDate)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      const weekStart = toISODate(d)

      const resp = await getWeekBlocks(weekStart)
      setBlocks(resp.blocks.filter((b) => b.scheduled_date === dateStr))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [dateStr, currentDate])

  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

  // Listen for refresh events from chat
  useEffect(() => {
    return on(REFRESH_CALENDAR, () => fetchBlocks())
  }, [fetchBlocks])

  // Scroll management: initial scroll to 5am, then restore position on refreshes
  useEffect(() => {
    if (!loading && scrollRef.current) {
      if (!didScroll.current) {
        didScroll.current = true
        const now = new Date()
        const scrollToHour = Math.max(5, now.getHours() - 1)
        scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT
      } else {
        scrollRef.current.scrollTop = savedScrollTop.current
      }
    }
  }, [loading])

  const navigateDay = (delta: number) => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + delta)
    setCurrentDate(next)
    didScroll.current = false
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    didScroll.current = false
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

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="h-full flex flex-col">
      {/* Day toolbar */}
      <div className="border-b border-border px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDay(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-hover text-text-secondary transition-colors text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => navigateDay(1)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-hover text-text-secondary transition-colors text-sm"
          >
            ›
          </button>
          <span className={cn('text-sm font-medium', isToday ? 'text-accent' : 'text-text-primary')}>
            {formatDate(currentDate)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchBlocks()}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-10.624-2.85a5.5 5.5 0 019.201-2.465l.312.311H11.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.536a.75.75 0 00-1.5 0v2.033l-.312-.311A7 7 0 002.63 8.396a.75.75 0 001.449.39z" clipRule="evenodd" />
            </svg>
          </button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="grid" style={{ gridTemplateColumns: '48px 1fr' }}>
            {/* Hour labels gutter */}
            <div className="relative border-r border-border/50">
              <HourLabels
                workStartHour={WORK_START}
                workEndHour={WORK_END}
                hourHeight={HOUR_HEIGHT}
              />
            </div>

            {/* Day column */}
            <DayColumn
              blocks={blocks}
              workStartHour={WORK_START}
              workEndHour={WORK_END}
              hourHeight={HOUR_HEIGHT}
              isToday={isToday}
              onLockToggle={handleLockToggle}
              onDelete={handleDelete}
              onBlockClick={onBlockClick}
              onBlockDoubleClick={onBlockDoubleClick}
            />
          </div>
        </div>
      )}
    </div>
  )
}
