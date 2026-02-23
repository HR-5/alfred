import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import MessageBubble from './MessageBubble'

interface Props {
  onQuickAction?: (action: string, payload: Record<string, unknown>) => void
}

export default function MessageList({ onQuickAction }: Props) {
  const messages = useChatStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted px-8">
        <img src="/logo.png" alt="Alfred" className="w-14 h-14 rounded-xl mb-4" />
        <h2 className="text-lg font-medium text-text-secondary mb-2">
          Good evening, Master Wayne.
        </h2>
        <p className="text-sm text-center max-w-md leading-relaxed">
          Shall we review tonight's agenda, or is there something more pressing?
          I'll organize, schedule, and ensure nothing slips through.
        </p>
        <div className="mt-6 space-y-2 text-xs text-text-muted">
          <p>Try: <span className="text-text-secondary">"Call Lucius tomorrow at 6pm about the new prototype"</span></p>
          <p>Try: <span className="text-text-secondary">"Finish the board presentation by Friday night, high priority"</span></p>
          <p>Try: <span className="text-text-secondary">"What's on the docket today?"</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-1">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onQuickAction={onQuickAction}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
