import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'

const navItems = [
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/tasks', label: 'Tasks', icon: '📋' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-bg-secondary border-r border-border flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">
          Alfred
        </h1>
        <p className="text-xs text-text-muted mt-0.5">The Batcave for your day</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <p className="text-xs text-text-muted text-center">v0.1.0</p>
      </div>
    </aside>
  )
}
