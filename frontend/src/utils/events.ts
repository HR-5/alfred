/** Lightweight pub/sub for cross-component refresh signals */

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

export function on(event: string, fn: Listener) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(fn)
  return () => listeners.get(event)?.delete(fn)
}

export function emit(event: string) {
  listeners.get(event)?.forEach((fn) => fn())
}

// Event names
export const REFRESH_CALENDAR = 'refresh:calendar'
export const REFRESH_TASKS = 'refresh:tasks'
