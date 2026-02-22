import { useState, useRef, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { useChatStore } from '@/store/chatStore'

interface Props {
  onSend: (message: string) => void
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState('')
  const loading = useChatStore((s) => s.loading)
  const draftMessage = useChatStore((s) => s.draftMessage)
  const setDraftMessage = useChatStore((s) => s.setDraftMessage)
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
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border p-3">
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
