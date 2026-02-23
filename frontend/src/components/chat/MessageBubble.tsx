import { cn } from '@/utils/cn'
import { formatTimestamp } from '@/utils/date'
import type { Message } from '@/types/chat'
import Badge from '@/components/ui/Badge'
import ThinkingSteps from './ThinkingSteps'

interface Props {
  message: Message
  onQuickAction?: (action: string, payload: Record<string, unknown>) => void
}

export default function MessageBubble({ message, onQuickAction }: Props) {
  const isUser = message.role === 'user'
  const hasSteps = message.thinking_steps && message.thinking_steps.length > 0

  return (
    <div className={cn('flex gap-3 px-4 py-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <img src="/logo.png" alt="Alfred" className="w-7 h-7 rounded-full shrink-0 mt-1" />
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-accent text-bg-primary rounded-br-md font-medium'
            : 'bg-bg-secondary border border-border rounded-bl-md'
        )}
      >
        {/* Thinking steps — shown during and after loading */}
        {hasSteps && <ThinkingSteps steps={message.thinking_steps!} />}

        {message.loading && !hasSteps ? (
          /* Pure loading state — no steps yet */
          <div className="flex items-center gap-2 py-1">
            <div className="w-4 h-4 shrink-0 relative">
              <div className="absolute inset-0 rounded-full border-2 border-accent/30" />
              <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
            <span className="text-sm text-text-muted">One moment, sir...</span>
          </div>
        ) : message.loading && hasSteps ? (
          /* Loading with steps — spinner handled by ThinkingSteps */
          null
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

            {message.task && (
              <div className="mt-2 p-2 rounded-lg bg-bg-primary/50 border border-border/50">
                <p className="text-xs font-medium">{message.task.title}</p>
                <div className="flex gap-1.5 mt-1">
                  {message.task.priority !== 'none' && (
                    <Badge variant="priority" value={message.task.priority}>
                      {message.task.priority}
                    </Badge>
                  )}
                  {message.task.due_date && (
                    <Badge>
                      {message.task.due_date}
                      {message.task.due_time && ` ${message.task.due_time}`}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {message.quick_actions && message.quick_actions.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {message.quick_actions.map((qa) => (
                  <button
                    key={qa.action}
                    onClick={() => onQuickAction?.(qa.action, qa.payload)}
                    className="px-2.5 py-1 text-xs rounded-md bg-bg-primary/50 hover:bg-bg-hover border border-border/50 transition-colors"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!message.loading && (
          <p className={cn('text-[10px] mt-1', isUser ? 'text-bg-primary/60' : 'text-text-muted')}>
            {formatTimestamp(message.timestamp)}
          </p>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-1">
          W
        </div>
      )}
    </div>
  )
}
