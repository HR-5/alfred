import { cn } from '@/utils/cn'

export default function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-accent',
        className
      )}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}
