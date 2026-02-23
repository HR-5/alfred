import { useNavigate } from 'react-router-dom'

const features = [
  {
    icon: '🎯',
    title: 'Natural Language Tasks',
    description:
      'Tell Alfred what needs doing. He parses your intent, extracts deadlines, and files it away — no forms, no friction.',
  },
  {
    icon: '🧠',
    title: 'Intelligent Scheduling',
    description:
      'Alfred considers priority, energy, deadlines, and your patterns to build a plan that actually works.',
  },
  {
    icon: '🔔',
    title: 'Proactive Reminders',
    description:
      'He nudges before deadlines, escalates overdue items, and ensures nothing falls through the cracks.',
  },
  {
    icon: '📊',
    title: 'Daily Planning & Review',
    description:
      'Start each day with a focused plan. End with a reflection. Build momentum that compounds.',
  },
  {
    icon: '🔒',
    title: 'Fully Private & Self-Hosted',
    description:
      'Your data stays on your machine. No cloud, no tracking, no third-party access. The Batcave is sealed.',
  },
  {
    icon: '🔌',
    title: 'Model Agnostic',
    description:
      'Ollama, Claude, OpenAI — plug in any LLM provider. Swap models without changing a thing.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Alfred" className="w-9 h-9 rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">Alfred</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/HR-5/alfred"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
          <button
            onClick={() => navigate('/app')}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-bg-primary hover:bg-accent-hover transition-colors"
          >
            Open Alfred
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 pt-24 pb-20 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-border text-xs text-text-secondary tracking-wide uppercase">
          Self-hosted &middot; Private &middot; Intelligent
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          <span className="text-text-primary">The silent guardian</span>
          <br />
          <span className="text-text-primary">of your </span>
          <span className="text-accent">to-do list.</span>
        </h1>

        <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10">
          Alfred is your personal AI task assistant — a private, self-hosted butler
          who organizes your day, tracks your commitments, and ensures nothing
          slips through the cracks.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="group px-7 py-3.5 rounded-xl bg-accent text-bg-primary font-semibold text-base hover:bg-accent-hover transition-all hover:shadow-lg hover:shadow-accent/20"
          >
            Get Started
            <span className="inline-block ml-2 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>
          <a
            href="https://github.com/HR-5/alfred"
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3.5 rounded-xl border border-border text-text-secondary font-medium text-base hover:border-border-light hover:text-text-primary transition-colors"
          >
            View Source
          </a>
        </div>

        {/* Terminal preview */}
        <div className="mt-16 max-w-xl mx-auto">
          <div className="rounded-2xl border border-border bg-bg-secondary overflow-hidden shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-danger/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="ml-2 text-xs text-text-muted">Alfred</span>
            </div>
            <div className="p-5 space-y-4 text-left text-sm font-mono">
              <div className="flex gap-3">
                <span className="text-accent shrink-0">you:</span>
                <span className="text-text-primary">
                  Call Lucius tomorrow at 6pm about the new prototype
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-text-muted shrink-0">alfred:</span>
                <span className="text-text-secondary">
                  Very good, sir. I've scheduled "Call Lucius about the new
                  prototype" for tomorrow at 6:00 PM, marked as high priority.
                  Shall I set a reminder 15 minutes prior?
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-accent shrink-0">you:</span>
                <span className="text-text-primary">What's on the docket today?</span>
              </div>
              <div className="flex gap-3">
                <span className="text-text-muted shrink-0">alfred:</span>
                <span className="text-text-secondary">
                  You have 3 items requiring attention today, sir. The board
                  presentation is due this evening — shall we review it first?
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything a proper butler should do.
          </h2>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            No bloated dashboards. No team features. Just a sharp,
            private assistant that keeps your life in order.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-border bg-bg-secondary/50 hover:bg-bg-secondary hover:border-border-light transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-lg mb-4 group-hover:bg-accent/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Quote / Philosophy */}
      <section className="relative z-10 max-w-3xl mx-auto px-8 py-24 text-center">
        <blockquote className="text-2xl sm:text-3xl font-medium italic text-text-secondary leading-relaxed">
          "Why do we fall, sir? So that we can learn to pick ourselves up."
        </blockquote>
        <p className="mt-4 text-sm text-text-muted">— Alfred Pennyworth</p>

        <p className="mt-10 text-text-secondary leading-relaxed max-w-lg mx-auto">
          Alfred doesn't judge your overdue tasks. He helps you reorganize,
          reprioritize, and get back on track. Every day is a fresh start.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-8 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Ready to let Alfred take the helm?
        </h2>
        <p className="text-text-secondary text-lg mb-8">
          Open source. Self-hosted. Your data, your rules.
        </p>
        <button
          onClick={() => navigate('/app')}
          className="group px-8 py-4 rounded-xl bg-accent text-bg-primary font-semibold text-lg hover:bg-accent-hover transition-all hover:shadow-lg hover:shadow-accent/20"
        >
          Enter the Batcave
          <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
            →
          </span>
        </button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <img src="/logo.png" alt="Alfred" className="w-5 h-5 rounded" />
            <span>Alfred v0.1.0</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a
              href="https://github.com/HR-5/alfred"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-secondary transition-colors"
            >
              GitHub
            </a>
            <span>Built in the Batcave</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
