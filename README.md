# OrgFlow

> AI-powered workflow and institutional-memory platform for student organizations.

---

## Problem

Student organizations experience frequent officer turnover. New officers often do not know:

- How previous officers handled events
- What school procedures must be followed
- Where important documents are located
- What decisions were made
- What worked and failed in previous years

Important knowledge becomes scattered across documents, emails, shared drives, meeting minutes, and the memories of former officers.

---

## Solution

OrgFlow gives current student leaders one workspace to:

- Ask questions about what they need to accomplish
- Plan events with AI-generated step-by-step action plans
- Assign and track tasks
- Manage deadlines
- Access school and organization resources
- Record decisions and document event outcomes
- Preserve lessons learned
- Transfer organizational knowledge to future officers

The central feature is **Ask OrgFlow** — a conversational interface where a student leader types what they are trying to accomplish and receives a structured, actionable plan.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                    React + Vite                         │
│        (no API keys — all AI calls go through server)   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP /api/*
┌───────────────────────▼─────────────────────────────────┐
│                    Express Server                        │
│  routes/  →  services/                                  │
│              ├── geminiService.js   (AI reasoning)      │
│              ├── backboardService.js (org knowledge)    │
│              └── supabaseService.js  (app data)         │
└──────────────┬──────────────────┬──────────────────────-┘
               │                  │                │
        ┌──────▼──────┐  ┌────────▼──────┐  ┌─────▼───────┐
        │   Supabase  │  │   Gemini AI   │  │  Backboard  │
        │ (app data)  │  │  (reasoning)  │  │  (org RAG)  │
        └─────────────┘  └───────────────┘  └─────────────┘
```

### Responsibility Separation

| Service       | Stores / Handles |
|---------------|-----------------|
| **Supabase**  | Structured app data: events, tasks, event reports |
| **Gemini**    | AI reasoning: understand requests, generate plans, structure actions |
| **Backboard** | Organizational knowledge: policies, history, officer recommendations |

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18, Vite, React Router v6 |
| Backend   | Node.js, Express |
| Database  | Supabase / PostgreSQL |
| AI        | Google Gemini API |
| Org Knowledge / RAG | Backboard API |

---

## Project Structure

```
orgflow/
  client/
    index.html
    vite.config.js
    package.json
    src/
      main.jsx
      App.jsx
      index.css
      components/
        Layout.jsx / Layout.css
        Sidebar.jsx / Sidebar.css
      pages/
        Dashboard.jsx / Dashboard.css
        AskOrgFlow.jsx / AskOrgFlow.css
        Events.jsx
        Tasks.jsx
        Resources.jsx
        PassTheTorch.jsx
      services/
        api.js              ← all frontend HTTP calls
      data/
        mockData.js         ← client-side demo data

  server/
    package.json
    server.js
    routes/
      health.js
      events.js
      tasks.js
      chat.js
      plan.js
      resources.js
      reflections.js
    services/
      geminiService.js      ← Gemini interface + mock
      backboardService.js   ← Backboard interface + mock
      supabaseService.js    ← Supabase interface + mock
    data/
      mockData.js           ← server-side demo data

  .env.example
  .gitignore
  README.md
```

---

## Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Clone the repository

```bash
git clone <repo-url>
cd orgflow
```

### 2. Configure environment (optional for mock mode)

```bash
cp .env.example server/.env
# Edit server/.env if you have real API keys
```

Mock mode is active by default — no API keys needed to run the app.

### 3. Install server dependencies

```bash
cd server
npm install
```

### 4. Install client dependencies

```bash
cd ../client
npm install
```

---

## Running Locally

### Start the backend (terminal 1)

```bash
cd server
npm run dev
# Server starts on http://localhost:3001
```

### Start the frontend (terminal 2)

```bash
cd client
npm run dev
# App opens on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so no CORS configuration is needed during development.

Visit **http://localhost:5173** in your browser.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `USE_MOCK` | `true` | Keep events and tasks in an in-memory demo store instead of Supabase |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key |
| `GEMINI_API_KEY` | — | Optional. Calls Gemini directly when set; otherwise Gemini runs through Backboard |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model used for plans and answers |
| `BACKBOARD_API_KEY` | — | Backboard API key. Backboard is live when set, mocked when empty |
| `BACKBOARD_ASSISTANT_NAME` | `OrgFlow` | Backboard assistant that holds the org's documents and memories (created on first use) |

---

## Mock Mode

With an empty `server/.env`, the application runs entirely without external API keys. Each service switches to real calls on its own:

- **Supabase** — an in-memory store seeded with demo data for Student Government, until `USE_MOCK=false` and Supabase credentials are set
- **Gemini** — a context-aware mock that returns realistic structured action plans, until `BACKBOARD_API_KEY` (Gemini through Backboard) or `GEMINI_API_KEY` (direct) is set
- **Backboard** — a mock that returns historical event data for known queries, until `BACKBOARD_API_KEY` is set

`GET /api/health` reports whether Gemini and Backboard are `live` or `mock`.

### Loading documents into Backboard

Put the organization's policies and past event records (PDF, Word, Markdown, text) in `server/knowledge/`, then:

```bash
cd server
npm run seed
```

Files already uploaded under the same name are skipped.

---

## Data Storage

Data belongs to a **club (organization)**, not to a person. Each club has an ID
and an invite code (sidebar → organization menu). New officers sign up, choose
"Join with an invite code", and inherit every event, task, document and wrap-up
the previous officers recorded — that's what Pass the Torch shows.

With `USE_MOCK=true` (the default) accounts are saved to `server/data/users.json`
and clubs with their events, tasks and resources to `server/data/store.json`.
Both survive restarts and are git-ignored — back them up on the server.
Set `JWT_SECRET` in `server/.env` before deploying.

## Supabase Schema

Used when `USE_MOCK=false`. Every data table has an `org_id`, so each club
only sees its own data, and every officer of the same club shares it.

```sql
-- clubs
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  type            text,
  "memberCount"   integer,
  "contactEmail"  text,
  officers        jsonb DEFAULT '[]',
  join_code       text UNIQUE NOT NULL,
  created_by      uuid,
  created_at      timestamptz DEFAULT now()
);

-- accounts (passwords are bcrypt hashes; login tokens are signed by the server)
CREATE TABLE profiles (
  id              uuid PRIMARY KEY,
  email           text UNIQUE NOT NULL,
  name            text,
  password_hash   text NOT NULL,
  org_id          uuid REFERENCES organizations(id),
  role            text,
  created_at      timestamptz DEFAULT now()
);

-- events
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  description     text,
  event_date      timestamptz NOT NULL,
  location        text,
  expected_attendance integer,
  budget          numeric,
  status          text DEFAULT 'planning',
  created_at      timestamptz DEFAULT now()
);

-- tasks
CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  event_id        uuid REFERENCES events(id) ON DELETE SET NULL,
  title           text NOT NULL,
  category        text,
  assigned_to     text,
  due_date        date,
  priority        text DEFAULT 'medium',
  status          text DEFAULT 'open',
  created_at      timestamptz DEFAULT now()
);

-- resources (uploaded documents; text files keep a copy for the View button)
CREATE TABLE resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  type            text,
  size            integer,
  content         text,
  backboard_id    text,
  file_path       text,
  is_hidden       boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Apply once to existing Supabase projects before deploying resource files/removal:
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Ask OrgFlow conversations (one per person per club)
CREATE TABLE chats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  thread_id       text,
  messages        jsonb DEFAULT '[]',
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- event_reports
CREATE TABLE event_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  event_id            uuid REFERENCES events(id) ON DELETE CASCADE,
  actual_attendance   integer,
  actual_spending     numeric,
  what_worked         text,
  what_went_wrong     text,
  recommendations     text,
  recorded_by         text,
  created_at          timestamptz DEFAULT now()
);
```

---

## Gemini Role

Gemini handles AI reasoning:

- Understands officer concerns expressed in natural language
- Generates structured event plans with actionable steps
- Categorizes and prioritizes actions
- Summarizes retrieved organizational knowledge

All Gemini calls go through `server/services/geminiService.js`. The frontend never has access to the Gemini API key.

---

## Backboard Role

Backboard provides organizational knowledge retrieval (RAG):

- Stores school policies, organization guidelines, constitutions
- Stores historical event data, lessons learned, officer recommendations
- Retrieved context is passed to Gemini to ground AI responses in real org history

All Backboard calls go through `server/services/backboardService.js`.

---

## MVP Flow

```
Student concern
      ↓
Ask OrgFlow (natural language input)
      ↓
Backboard retrieves relevant org history
      ↓
Gemini generates structured action plan
      ↓
Officer reviews recommended actions
      ↓
Actions added to event as tasks
      ↓
Tasks assigned, tracked, completed
      ↓
Event wrap-up: record what worked / what failed
      ↓
Lessons saved to Backboard
      ↓
Future officer asks OrgFlow about the same event
      ↓
Previous knowledge retrieved and surfaced
```
