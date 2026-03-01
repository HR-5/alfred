import { useState } from 'react'
import SettingsModal from '@/components/settings/SettingsModal'
import ProjectsPanel from '@/components/projects/ProjectsPanel'
import BlockedSitesModal from '@/components/settings/BlockedSitesModal'

export default function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [blockedSitesOpen, setBlockedSitesOpen] = useState(false)

  return (
    <>
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Alfred" className="w-7 h-7 rounded" />
          <span className="text-sm font-semibold text-text-primary tracking-wide">Alfred</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Projects button */}
          <button
            onClick={() => setProjectsOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Projects"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
            </svg>
          </button>

          {/* Blocked Sites button */}
          <button
            onClick={() => setBlockedSitesOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Blocked Sites"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {projectsOpen && <ProjectsPanel onClose={() => setProjectsOpen(false)} />}
      {blockedSitesOpen && <BlockedSitesModal onClose={() => setBlockedSitesOpen(false)} />}
    </>
  )
}
