import { useCallback, useState } from 'react'
import Header from './Header'
import WeekView from '@/components/calendar/WeekView'
import DayView from '@/components/calendar/DayView'
import ChatPanel from '@/components/chat/ChatPanel'
import TaskDrawer from '@/components/tasks/TaskDrawer'
import { useChatStore } from '@/store/chatStore'
import type { CalendarBlock } from '@/types/calendar'
import { formatTime } from '@/utils/date'
import { cn } from '@/utils/cn'

type MobileTab = 'calendar' | 'chat'

export default function CanvasLayout() {
  const setDraftMessage = useChatStore((s) => s.setDraftMessage)
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  const handleBlockClick = useCallback(
    (block: CalendarBlock) => {
      const time = `${formatTime(block.start_time)}–${formatTime(block.end_time)}`
      setDraftMessage(`About "${block.task_title}" (${block.scheduled_date} ${time}): `)
      // On mobile, switch to chat tab after clicking a block
      setMobileTab('chat')
    },
    [setDraftMessage],
  )

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <Header />

      {/* Mobile tab bar — visible below md breakpoint */}
      <div className="md:hidden flex border-b border-border shrink-0">
        <button
          onClick={() => setMobileTab('calendar')}
          className={cn(
            'flex-1 py-2.5 text-xs font-medium text-center transition-colors',
            mobileTab === 'calendar'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          Calendar
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={cn(
            'flex-1 py-2.5 text-xs font-medium text-center transition-colors',
            mobileTab === 'chat'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          Chat
        </button>
      </div>

      {/* Desktop layout — side by side */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left panel — Calendar + Tasks drawer */}
        <div className="w-[60%] flex flex-col border-r border-border overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <WeekView onBlockClick={handleBlockClick} />
          </div>
          <TaskDrawer />
        </div>

        {/* Right panel — Chat */}
        <div className="w-[40%] flex flex-col overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      {/* Mobile layout — tabbed, uses DayView instead of WeekView */}
      <div className="md:hidden flex-1 overflow-hidden">
        {mobileTab === 'calendar' ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <DayView onBlockClick={handleBlockClick} />
            </div>
            <TaskDrawer />
          </div>
        ) : (
          <ChatPanel />
        )}
      </div>
    </div>
  )
}
