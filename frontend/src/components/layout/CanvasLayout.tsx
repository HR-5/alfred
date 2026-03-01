import { useCallback, useState } from 'react'
import Header from './Header'
import WeekView from '@/components/calendar/WeekView'
import DayView from '@/components/calendar/DayView'
import ChatPanel from '@/components/chat/ChatPanel'
import TaskDrawer from '@/components/tasks/TaskDrawer'
import EventDetailPanel from '@/components/calendar/EventDetailPanel'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'
import type { CalendarBlock } from '@/types/calendar'
import { formatTime } from '@/utils/date'
import { cn } from '@/utils/cn'

type MobileTab = 'calendar' | 'chat'

export default function CanvasLayout() {
  const setDraftMessage = useChatStore((s) => s.setDraftMessage)
  const setPinnedEvent = useUIStore((s) => s.setPinnedEvent)
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null)

  const handleBlockClick = useCallback((block: CalendarBlock) => {
    setSelectedBlock(block)
  }, [])

  const handleBlockDoubleClick = useCallback((block: CalendarBlock) => {
    setPinnedEvent(block)
    setMobileTab('chat')
  }, [setPinnedEvent])

  const handleChatAbout = useCallback(
    (block: CalendarBlock) => {
      const time = `${formatTime(block.start_time)}–${formatTime(block.end_time)}`
      setDraftMessage(`About "${block.task_title}" (${block.scheduled_date} ${time}): `)
      setSelectedBlock(null)
      setMobileTab('chat')
    },
    [setDraftMessage],
  )

  const handlePanelClose = useCallback(() => {
    setSelectedBlock(null)
  }, [])

  const handleBlockDeleted = useCallback(() => {
    setSelectedBlock(null)
    // WeekView/DayView will refetch on next render cycle
  }, [])

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
        <div
          className={cn(
            'flex flex-col border-r border-border overflow-hidden transition-all',
            selectedBlock ? 'w-[40%]' : 'w-[60%]',
          )}
        >
          <div className="flex-1 overflow-hidden">
            <WeekView onBlockClick={handleBlockClick} onBlockDoubleClick={handleBlockDoubleClick} />
          </div>
          <TaskDrawer />
        </div>

        {/* Center panel — Event detail (when selected) */}
        {selectedBlock && (
          <div className="w-[20%] min-w-[260px] flex flex-col overflow-hidden border-r border-border">
            <EventDetailPanel
              block={selectedBlock}
              onClose={handlePanelClose}
              onChatAbout={handleChatAbout}
              onDeleted={handleBlockDeleted}
            />
          </div>
        )}

        {/* Right panel — Chat */}
        <div
          className={cn(
            'flex flex-col overflow-hidden transition-all',
            selectedBlock ? 'w-[40%]' : 'w-[40%]',
          )}
        >
          <ChatPanel />
        </div>
      </div>

      {/* Mobile layout — tabbed, uses DayView instead of WeekView */}
      <div className="md:hidden flex-1 overflow-hidden">
        {selectedBlock ? (
          <EventDetailPanel
            block={selectedBlock}
            onClose={handlePanelClose}
            onChatAbout={handleChatAbout}
            onDeleted={handleBlockDeleted}
          />
        ) : mobileTab === 'calendar' ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <DayView onBlockClick={handleBlockClick} onBlockDoubleClick={handleBlockDoubleClick} />
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
