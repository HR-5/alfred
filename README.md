# Alfred

> *"Why do we fall, sir? So that we can learn to pick ourselves up."*

Alfred is your personal execution system — the silent guardian of your calendar, the watchful protector of your to-do list. Built for those who need more than a task app; built for those who need an accountability partner who never sleeps.

Named after Alfred Pennyworth — the man who kept the Batcave running and Bruce Wayne on track — this is a self-hostable, AI-powered assistant that captures tasks in natural language, schedules them intelligently, and makes sure nothing falls through the cracks.

**This is not a team tool. Not a SaaS product. Not another Notion clone.**

This is your personal command center.

---

## What Alfred Does

**Capture** — Tell Alfred what needs doing, in plain language.
```
"Call Shiva tomorrow at 6pm about pricing"
"Finish the investor deck by Friday night, high priority"
"Remind me in 20 minutes to drink water"
```

**Organize** — Alfred schedules tasks into your calendar based on priority, deadlines, and your energy patterns.

**Remind** — Get nudged before each task. Snooze, reschedule, or mark done with one click.

**Plan** — Every morning, Alfred generates a battle plan for the day. Review, approve, modify.

**Review** — Every evening, see what got done and what didn't. Reflect. Adjust. Improve.

**Learn** — Alfred tracks your patterns. No motivational fluff — just data. *"You complete deep work 91% of the time before 11am vs 45% in the afternoon."*

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python, FastAPI, SQLAlchemy (async), SQLite |
| Frontend | TypeScript, React, Tailwind CSS, Vite |
| LLM | Plug-and-play: Ollama (local), Claude (Anthropic), OpenAI |

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- An LLM provider (Ollama running locally, or an Anthropic/OpenAI API key)

### Setup

```bash
# Clone
git clone https://github.com/HR-5/alfred.git
cd alfred

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" "sqlalchemy[asyncio]" aiosqlite alembic pydantic-settings httpx python-dateutil

# Install your LLM provider SDK
pip install anthropic    # for Claude
# pip install openai     # for OpenAI
# (Ollama needs no SDK)

# Configure
cp ../.env.example .env
# Edit .env with your API key and provider choice

# Database
mkdir -p data && PYTHONPATH=. alembic upgrade head

# Run
uvicorn app.main:app --reload --port 8000
```

```bash
# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

### Configuration

Edit `backend/.env`:

```env
# LLM Provider: "ollama" | "anthropic" | "openai"
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=sk-ant-...

# Or use Ollama (free, local)
# LLM_PROVIDER=ollama
# LLM_MODEL=llama3.2
# OLLAMA_BASE_URL=http://localhost:11434

TIMEZONE=Asia/Kolkata
```

---

## Architecture

```
User (chat) ──> Intent Engine (LLM) ──> Command Router
                                            │
               ┌────────────────────────────┼────────────────┐
               ▼                            ▼                ▼
          Task Service              Calendar Engine    Reminder Service
               │                            │                │
               └────────────────────────────┼────────────────┘
                                            ▼
                                     SQLite Database
```

- **Intent Engine** — Parses natural language into structured intents (add_task, query, reschedule, etc.) using any LLM
- **Chat Orchestrator** — Routes parsed intents to the right service and builds conversational responses
- **LLM Adapter** — Abstract interface with implementations for Ollama, Claude, and OpenAI. Swap providers with one env var
- **Task Service** — CRUD with fuzzy search, behavioral tracking (snooze count, reschedule count)
- **Calendar Engine** — Auto-scheduling with urgency scoring, energy matching, conflict detection *(Phase 2)*
- **Daily Loop** — Morning plan generation + evening review with structured reflection *(Phase 2)*
- **Behavioral Engine** — Pattern analysis, data-driven nudges, no fluff *(Phase 3)*

---

## Principles

- **Single user only** — No auth complexity. Your data stays on your machine.
- **Privacy first** — Self-hosted. No telemetry. No external calls except to your chosen LLM.
- **Model agnostic** — Works with any LLM. Run fully offline with Ollama.
- **Chat first** — The primary interface is natural language. Structured views are secondary.
- **Data, not motivation** — Behavioral insights based on your actual patterns. No generic quotes.

---

## Roadmap

- [x] Phase 1 — Chat + NL task management + Task list UI
- [ ] Phase 2 — Calendar engine + auto-scheduling + daily plan/review loops
- [ ] Phase 3 — Reminders + WebSocket push notifications
- [ ] Phase 4 — Behavioral intelligence + long-term memory
- [ ] Phase 5 — Voice input, messaging bridges (Telegram/WhatsApp)

---

## License

MIT

---

*"Some men just want to watch the world burn. Alfred makes sure you don't."*
