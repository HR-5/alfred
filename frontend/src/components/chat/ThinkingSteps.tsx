import { useState } from 'react'
import { cn } from '@/utils/cn'
import type { ThinkingStep } from '@/types/chat'

interface Props {
  steps: ThinkingStep[]
}

const TOOL_ICONS: Record<string, string> = {
  list_tasks: '🔍',
  find_tasks: '🔍',
  create_task: '✏️',
  update_task: '📝',
  delete_task: '🗑️',
  complete_task: '✅',
  get_calendar_blocks: '📅',
  delete_calendar_block: '📅',
  update_calendar_block: '📅',
  schedule_week: '⚡',
}

export default function ThinkingSteps({ steps }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (steps.length === 0) return null

  const allDone = steps.every((s) => s.status === 'done')
  const lastRunning = [...steps].reverse().find((s: ThinkingStep) => s.status === 'running')

  return (
    <div className="mb-2">
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg transition-colors',
          'hover:bg-bg-primary/30 group',
        )}
      >
        {/* Animated indicator */}
        {!allDone ? (
          <div className="w-4 h-4 shrink-0 relative">
            <div className="absolute inset-0 rounded-full border-2 border-accent/30" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : (
          <svg
            className="w-4 h-4 text-accent shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        <span className="text-xs text-text-secondary flex-1 truncate">
          {!allDone && lastRunning
            ? lastRunning.summary
            : `Analyzed in ${steps.length} step${steps.length > 1 ? 's' : ''}`}
        </span>

        {/* Expand chevron */}
        <svg
          className={cn(
            'w-3 h-3 text-text-muted transition-transform',
            expanded && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded steps */}
      {expanded && (
        <div className="ml-2 mt-1 border-l-2 border-border/40 pl-3 space-y-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              {step.status === 'running' ? (
                <div className="w-3 h-3 mt-0.5 shrink-0 relative">
                  <div className="absolute inset-0 rounded-full border border-accent/30" />
                  <div className="absolute inset-0 rounded-full border border-accent border-t-transparent animate-spin" />
                </div>
              ) : (
                <span className="text-[10px] mt-0.5 shrink-0">
                  {TOOL_ICONS[step.tool] || '⚙️'}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] text-text-secondary truncate">
                  {step.summary}
                </p>
                {step.status === 'done' && step.result && (
                  <p className="text-[10px] text-text-muted truncate">
                    → {step.result}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
