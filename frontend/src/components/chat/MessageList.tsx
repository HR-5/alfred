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
        <div className="text-5xl mb-4">🦇</div>
        <h2 className="text-lg font-medium text-text-secondary mb-2">
          Good day. How may I assist you?
        </h2>
        <p className="text-sm text-center max-w-md leading-relaxed">
          Tell me what needs doing, sir. I'll organize it, schedule it, and ensure it gets done.
        </p>
        <div className="mt-6 space-y-2 text-xs text-text-muted">
          <p>Try: <span className="text-text-secondary">"Call Shiva tomorrow at 6pm about pricing"</span></p>
          <p>Try: <span className="text-text-secondary">"Finish YC deck by Friday night, high priority"</span></p>
          <p>Try: <span className="text-text-secondary">"What do I have today?"</span></p>
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
