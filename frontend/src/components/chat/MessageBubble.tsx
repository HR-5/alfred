import { cn } from '@/utils/cn'
import { formatTimestamp } from '@/utils/date'
import type { Message, ReferencedTask, ReferencedBlock } from '@/types/chat'
import type { CalendarBlock } from '@/types/calendar'
import Badge from '@/components/ui/Badge'
import ThinkingSteps from './ThinkingSteps'
import { useUIStore } from '@/store/uiStore'

interface Props {
  message: Message
  onQuickAction?: (action: string, payload: Record<string, unknown>) => void
}

export default function MessageBubble({ message, onQuickAction }: Props) {
  const isUser = message.role === 'user'
  const hasSteps = message.thinking_steps && message.thinking_steps.length > 0
  const setPinnedTask = useUIStore((s) => s.setPinnedTask)
  const setPinnedEvent = useUIStore((s) => s.setPinnedEvent)

  function handleTaskChipClick(task: ReferencedTask) {
    setPinnedTask(task)
  }

  function handleBlockChipClick(block: ReferencedBlock) {
    // Build a minimal CalendarBlock to pin as event context
    setPinnedEvent({
      id: block.id,
      task_id: null,
      scheduled_date: block.date,
      start_time: block.start_time,
      end_time: block.end_time,
      duration_minutes: 0,
      status: 'scheduled',
      is_locked: false,
      task_title: block.title,
      task_priority: 'none',
      task_energy_level: null,
      task_status: 'todo',
    } as CalendarBlock)
  }

  const hasChips =
    !message.loading &&
    ((message.referenced_tasks && message.referenced_tasks.length > 0) ||
      (message.referenced_blocks && message.referenced_blocks.length > 0))

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

            {/* Referenced task / block chips */}
            {hasChips && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {message.referenced_tasks?.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskChipClick(task)}
                    title="Add to context"
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 shrink-0">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                    {task.title}
                  </button>
                ))}
                {message.referenced_blocks?.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockChipClick(block)}
                    title="Add to context"
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 shrink-0">
                      <path d="M5.75 7.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z" />
                      <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h6.5A2.75 2.75 0 0 1 14 4.75v6.5A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5Zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25h-6.5Z" clipRule="evenodd" />
                    </svg>
                    {block.title} · {block.start_time}
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
