import { useState, useRef, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'
import { formatTime } from '@/utils/date'

interface Props {
  onSend: (message: string) => void
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState('')
  const loading = useChatStore((s) => s.loading)
  const draftMessage = useChatStore((s) => s.draftMessage)
  const setDraftMessage = useChatStore((s) => s.setDraftMessage)
  const pinnedEvent = useUIStore((s) => s.pinnedEvent)
  const setPinnedEvent = useUIStore((s) => s.setPinnedEvent)
  const pinnedTask = useUIStore((s) => s.pinnedTask)
  const setPinnedTask = useUIStore((s) => s.setPinnedTask)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  // Pick up draft messages from calendar event clicks
  useEffect(() => {
    if (draftMessage) {
      setText(draftMessage)
      setDraftMessage('')
      inputRef.current?.focus()
    }
  }, [draftMessage, setDraftMessage])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    let finalMessage = trimmed
    if (pinnedEvent) {
      const time = `${formatTime(pinnedEvent.start_time)}–${formatTime(pinnedEvent.end_time)}`
      const ctx = `[Context: Event "${pinnedEvent.task_title}" on ${pinnedEvent.scheduled_date} at ${time}]`
      finalMessage = `${ctx}\n\n${trimmed}`
      setPinnedEvent(null)
    } else if (pinnedTask) {
      finalMessage = `[Context: Task "${pinnedTask.title}" (id: ${pinnedTask.id})]\n\n${trimmed}`
      setPinnedTask(null)
    }

    onSend(finalMessage)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const quickActions = [
    { label: 'Pending tasks', message: 'List my pending tasks' },
    { label: "Today's calendar", message: "What's on my calendar today?" },
    { label: 'Schedule week', message: 'Schedule my week' },
  ]

  return (
    <div className="border-t border-border p-3">
      {/* Quick action chips — shown when input is empty */}
      {!text && !loading && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={() => onSend(qa.message)}
              className="px-2.5 py-1 text-[11px] text-text-muted bg-bg-secondary border border-border rounded-full hover:border-accent/50 hover:text-accent transition-colors"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Pinned event chip */}
      {pinnedEvent && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-accent/10 border border-accent/30 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-accent shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-accent flex-1 truncate">
            {pinnedEvent.task_title} · {formatTime(pinnedEvent.start_time)}–{formatTime(pinnedEvent.end_time)}
          </span>
          <button
            onClick={() => setPinnedEvent(null)}
            className="text-accent/60 hover:text-accent transition-colors"
            title="Remove context"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Pinned task chip */}
      {pinnedTask && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-accent/10 border border-accent/30 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-accent shrink-0">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-accent flex-1 truncate">
            Task: {pinnedTask.title}
          </span>
          <button
            onClick={() => setPinnedTask(null)}
            className="text-accent/60 hover:text-accent transition-colors"
            title="Remove context"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-bg-secondary rounded-xl border border-border px-3 py-2 focus-within:border-accent/50 transition-colors">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What shall we attend to, sir?"
          rows={1}
          disabled={loading}
          className={cn(
            'flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted',
            'resize-none outline-none min-h-[24px] max-h-[120px]',
            'disabled:opacity-50'
          )}
          style={{ height: 'auto' }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className={cn(
            'p-1.5 rounded-lg transition-colors shrink-0',
            text.trim() && !loading
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'text-text-muted cursor-not-allowed'
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
      <p className="text-[10px] text-text-muted mt-1.5 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
