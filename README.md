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

**Remind** — Get nudged before each task via Telegram. Snooze, reschedule, or mark done.

**Plan** — Every morning, Alfred generates a battle plan for the day. Review, approve, modify.

**Sync** — Two-way sync with Google Calendar. Your Alfred schedule and Google events stay in lockstep.

**Learn** — Alfred tracks your patterns. No motivational fluff — just data. *"You complete deep work 91% of the time before 11am vs 45% in the afternoon."*

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy (async), SQLite |
| Frontend | TypeScript, React 19, Tailwind CSS 4, Vite |
| LLM | Plug-and-play: Ollama (local), Claude (Anthropic), OpenAI |
| Integrations | Google Calendar (OAuth 2.0), Telegram Bot |
| State | Zustand (client), React Query (server) |

---

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
pip install -e ".[all]"    # Installs all dependencies including optional integrations

# Or install selectively:
# pip install -e .                          # Core only
# pip install -e ".[anthropic]"             # + Claude support
# pip install -e ".[google,telegram]"       # + Google Calendar + Telegram

# Configure
cp ../.env.example .env
# Edit .env with your API keys and preferences

# Database
mkdir -p data && PYTHONPATH=. alembic upgrade head

# Run
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

```bash
# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Configuration

Copy `.env.example` to `backend/.env` and configure. See the file for all options with descriptions.

### LLM Provider

Alfred supports three LLM providers. Set `LLM_PROVIDER` in your `.env`:

| Provider | Setup | Tool Calling | Notes |
|----------|-------|:------------:|-------|
| **Anthropic (Claude)** | Set `ANTHROPIC_API_KEY` | Yes | Tested and recommended. Full agentic capabilities. |
| **OpenAI** | Set `OPENAI_API_KEY` | No | Structured output works. Tool calling not yet implemented. |
| **Ollama** | Install [Ollama](https://ollama.com), run model | No | Free, fully offline. No tool calling support. |

> **Note:** Alfred's agentic features (multi-step tool calling, calendar scheduling via chat, task search) require a provider with tool calling support. Currently, only the **Anthropic (Claude)** adapter has been tested with the full agentic loop. OpenAI and Ollama adapters handle basic chat and structured output but do not support tool use — contributions to implement tool calling for these adapters are very welcome!

**Recommended models:**

```env
# Anthropic — fast & capable (tested)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-4-5-20251001

# Anthropic — more capable
LLM_MODEL=claude-sonnet-4-20250514

# OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Ollama (free, local, offline)
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
```

---

## Google Calendar Integration

Two-way sync between Alfred and Google Calendar. Alfred blocks get pushed to Google, and Google events get pulled into Alfred.

### Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use an existing one)

2. **Enable the Calendar API**
   - Go to **APIs & Services > Library**
   - Search for and enable **Google Calendar API**

3. **Create OAuth Credentials**
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Add authorized redirect URI:
     ```
     http://localhost:8000/api/v1/integrations/google/callback
     ```
   - Copy the **Client ID** and **Client Secret**

4. **Configure OAuth Consent Screen**
   - Go to **APIs & Services > OAuth consent screen**
   - Choose **External** user type
   - Fill in app name (e.g., "Alfred")
   - Add your email as a **test user**
   - While in testing mode, only added test users can authorize

5. **Add to `.env`**
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/integrations/google/callback
   GOOGLE_CALENDAR_ID=primary
   ```

6. **Connect from Alfred**
   - Open Alfred in your browser
   - Click the **Settings** gear icon
   - Under **Google Calendar**, click **Connect Google Calendar**
   - Authorize in the Google consent screen
   - Click **Sync Now** to do the initial sync

### How Sync Works

- **Push:** Alfred task blocks without a Google event ID get created in Google Calendar
- **Pull:** Google events not already in Alfred get imported as locked blocks
- **Delete:** Events deleted in Google get removed from Alfred on next sync
- **Update:** Changes to event titles/times in Google get reflected in Alfred
- **Auto-sync:** Calendar syncs automatically every 15 minutes when connected
- **Manual sync:** Use the **Sync** button in the calendar toolbar anytime

---

## Telegram Bot Integration

Use Alfred via Telegram for on-the-go task management and proactive notifications.

### Setup

1. **Create a Bot**
   - Open Telegram and message [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the prompts
   - Copy the **bot token** (format: `123456:ABC-DEF...`)

2. **Add to `.env`**
   ```env
   TELEGRAM_BOT_TOKEN=your-bot-token-here
   ```

3. **Start Using**
   - Restart the backend server
   - Open your bot in Telegram and send `/start`
   - Alfred will auto-capture your chat ID for proactive notifications
   - Chat naturally — the bot has the same agentic capabilities as the web UI

### Features

- **Full agentic chat** — Same tool-calling capabilities as the web interface
- **Morning briefing** — Daily schedule summary at your configured wake time
- **Upcoming reminders** — Notifications before each calendar block starts
- **Periodic check-ins** — Every 2 hours during work hours, Alfred asks about progress
- **Auto chat ID** — No manual configuration needed; sends `/start` and you're set

### Optional: Set Chat ID Manually

If you want proactive notifications without messaging the bot first:
```env
TELEGRAM_CHAT_ID=your-telegram-chat-id
```
You can find your chat ID by messaging [@userinfobot](https://t.me/userinfobot) on Telegram.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              Frontend (React)                │
                    │  Chat Panel │ Calendar (Week/Day) │ Tasks   │
                    └──────────────────┬──────────────────────────┘
                                       │ REST + SSE
                    ┌──────────────────▼──────────────────────────┐
                    │              FastAPI Backend                  │
                    │                                              │
                    │  Chat ──> Orchestrator ──> Tool Loop (≤8)   │
                    │              │                                │
                    │    ┌─────────┼──────────┬──────────┐        │
                    │    ▼         ▼          ▼          ▼        │
                    │  Tasks   Calendar   Scheduler   Search      │
                    │    │         │          │          │        │
                    │    └─────────┼──────────┴──────────┘        │
                    │              ▼                                │
                    │         SQLite (async)                        │
                    │                                              │
                    │  ┌──────────────────────────────────┐       │
                    │  │         Integrations              │       │
                    │  │  Google Calendar │ Telegram Bot   │       │
                    │  └──────────────────────────────────┘       │
                    └──────────────────────────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   LLM Adapter    │
                              │ Claude │ OpenAI  │
                              │     Ollama       │
                              └─────────────────┘
```

### Key Components

- **Chat Orchestrator** — Agentic loop that parses user intent, calls tools (up to 8 turns), and generates responses. Streams via SSE.
- **LLM Adapter** — Abstract interface with implementations for Anthropic, OpenAI, and Ollama. Swap providers with one env var.
- **Task Service** — CRUD with fuzzy search, behavioral tracking (snooze/reschedule counts), recurring tasks.
- **Calendar Engine** — Auto-scheduling with urgency scoring, energy matching, conflict detection.
- **Scheduler** — Scores tasks by priority + urgency + energy level, fits them into available time slots.
- **Google Calendar Service** — OAuth 2.0 flow, two-way sync with deletion detection.
- **Telegram Service** — Long-polling bot with proactive morning briefings and periodic check-ins.

### API Endpoints

| Group | Endpoints |
|-------|-----------|
| **Chat** | `POST /chat`, `POST /chat/stream` (SSE) |
| **Tasks** | `GET/POST /tasks`, `GET/PUT/DELETE /tasks/{id}`, `POST /tasks/{id}/complete`, `POST /tasks/{id}/notes` |
| **Calendar** | `GET /calendar/blocks`, `POST /calendar/schedule`, `POST/PUT/DELETE /calendar/blocks/{id}`, `POST /calendar/blocks/{id}/lock` |
| **Block Details** | `GET /calendar/blocks/{id}`, `POST /calendar/blocks/{id}/notes`, `POST /calendar/blocks/{id}/tag`, `DELETE /calendar/blocks/{id}/tag/{task_id}` |
| **Google Calendar** | `GET /integrations/google/connect`, `GET .../callback`, `POST .../disconnect`, `GET .../status`, `POST .../sync` |
| **Settings** | `GET /settings`, `GET /settings/llm/health` |

All endpoints are prefixed with `/api/v1/`.

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
- [x] Phase 2 — Calendar engine + auto-scheduling + weekly planner
- [x] Phase 3 — Agentic tool-calling + SSE streaming + canvas layout
- [x] Phase 4 — Mobile day view + responsive design
- [x] Phase 5 — Google Calendar two-way sync + Telegram bot + proactive notifications
- [x] Phase 6 — Event detail panel + multi-task tagging + block notes
- [ ] Phase 7 — Behavioral intelligence + long-term memory
- [ ] Phase 8 — Voice input, WhatsApp bridge

---

## Contributing

Alfred's agentic loop has been tested exclusively with **Anthropic's Claude** models. If you'd like to contribute:

- **OpenAI tool calling adapter** — Implement `generate_with_tools()` in `backend/app/llm/openai_adapter.py`
- **Ollama tool calling adapter** — Implement `generate_with_tools()` in `backend/app/llm/ollama_adapter.py`
- **Bug fixes, UI improvements, new features** — PRs welcome

---

## License

MIT

---

*"Some men just want to watch the world burn. Alfred makes sure you don't."*
