# Parallel Agent Execution and Review System

**Multiple AI coding agents, working on isolated git branches, in parallel — with a mandatory human review gate before anything ever merges.**

This is not a "vibe coding" tool. It's built on the opposite premise: AI agents are useful for exploring and drafting code changes, but no change should ever reach a real branch without a human deciding it's correct. The system exists to make that review fast and safe, even when several tasks are running at once.

---

## The problem this solves

Handing a coding agent a list of independent tasks and letting it run them one at a time is slow. Letting it run them all at once *in the same working directory* is dangerous — one task's half-finished edit can corrupt another task's context, and there's no clean way to review "which change came from which task."

The fix used here is the same one real parallel-agent tools (Conductor, Verdent AI, and others) use: give every task its own isolated `git worktree` — a separate branch, checked out into its own folder, sharing the same underlying repository — so agents can work fully in parallel without ever touching each other's files. Nothing merges automatically; every result sits in a review queue until a human approves or rejects it.

---

## Core design decisions

- **Isolation is structural, not trusted.** Each task's agent gets its own `git worktree` and its own set of file-access tools, built via a factory function that closes over that one task's folder path. The model never receives a "which worktree" argument — it physically cannot address another task's files, even if prompted to.
- **Two explicit modes, chosen per task, by a human:**
  - **Edit mode** — the agent reads, writes, and modifies files directly on its isolated branch.
  - **Suggest mode** — the agent has no write access at all. It can only call `propose_change`, which records a proposed diff (path, rationale, full proposed content) without touching disk. A developer reviews and applies it manually.
- **Nothing merges without a human click.** Every task ends in a `needs_review` state. Approve/reject is a deliberate action, not automatic.
- **Real concurrency, not simulated.** Tasks run through a Redis-backed job queue (RQ), picked up by independent worker processes — genuine parallel execution, not just deferred/background execution in a single process.

---

## Architecture

```
┌─────────────┐      REST       ┌──────────────┐
│   Next.js    │ ───────────────▶│   FastAPI     │
│  Dashboard   │◀─────────────── │   Backend     │
└─────────────┘   poll (SWR)    └──────┬───────┘
                                        │
                     ┌──────────────────┼───────────────────┐
                     ▼                  ▼                    ▼
              ┌─────────────┐   ┌──────────────┐     ┌──────────────┐
              │  Postgres    │   │  Redis (RQ)  │     │  Filesystem   │
              │  (Neon)      │   │  job queue   │     │  git worktrees│
              │  task state  │   │              │     │              │
              └─────────────┘   └──────┬───────┘     └──────────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │ Worker 1 │ │ Worker 2 │ │ Worker N │
                    │ run_task │ │ run_task │ │ run_task │
                    └────┬─────┘ └────┬─────┘ └────┬─────┘
                         │            │            │
                         ▼            ▼            ▼
                  isolated       isolated      isolated
                  worktree +     worktree +    worktree +
                  LangGraph      LangGraph     LangGraph
                  agent (Groq)   agent (Groq)  agent (Groq)
```

Each worker pulls a task off the queue, creates a fresh `git worktree` for it, runs a LangGraph ReAct agent scoped to that one folder, and writes the result (diff, proposals, or error) back to Postgres. The dashboard polls both the task table and a live `/queue/status` endpoint that reads worker/queue state directly from Redis — so the "Workers" panel reflects real RQ internals, not an inference from task rows.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, plain JS/JSX), Tailwind CSS, SWR |
| Backend API | FastAPI |
| Database | PostgreSQL (Neon), SQLModel |
| Job queue | Redis (Upstash), RQ |
| Agent orchestration | LangGraph (`create_react_agent`), LangChain tools |
| LLM inference | Groq (`openai/gpt-oss-120b`) |
| Version control | GitPython, native `git worktree` |
| Diff rendering | `react-diff-viewer-continued` |

---

## Project structure

```
backend/
  app/
    agent.py            # Builds the LangGraph agent, edit/suggest system prompts
    config.py            # Central env var + path loading
    main.py               # FastAPI app: task CRUD, approve/reject, queue status
    task_runner.py        # Core run_task(): worktree -> agent -> DB, safe to re-run
    queue.py              # RQ Queue + Redis connection
    db/
      models.py           # Task SQLModel (also doubles as the API schema)
      session.py           # SQLAlchemy engine + session factory
    git/
      worktree.py          # create/remove worktree, get diff
    tools/
      fs_tools.py           # read_file / list_files / edit_file, path-scoped
      bash_tools.py          # sandboxed (cwd-scoped) shell tool, timeout-capped
      suggest_tools.py        # propose_change tool for suggest mode
  step1.py                # Standalone CLI proof of the core mechanic (worktree + agent, no API)
  requirements.txt

frontend/
  src/
    app/
      (app)/
        page.jsx           # Task list, creation form, live Workers panel
        tasks/[id]/page.jsx  # Task detail: diff viewer, proposal cards, approve/reject
        layout.jsx          # Sidebar shell for in-app pages
      login/, signup/       # Visual scaffold only — not yet wired to real auth
      layout.jsx           # Root layout, fonts, global styles
    components/            # Sidebar, auth cards, brand mark
    lib/api.js              # Fetch helpers for the FastAPI backend
```

---

## Getting started

### 1. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` in the project root (one level above `backend/`):
```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b        # optional, this is the default

DATABASE_URL=postgresql://user:pass@your-neon-host/dbname?sslmode=require
REDIS_URL=rediss://default:password@your-upstash-host:6379

TARGET_REPO_PATH=/absolute/path/to/your/cloned/target/repo   # optional override
```

If `TARGET_REPO_PATH` is not set, the backend expects a repo already cloned at `workspaces/base/<repo-name>` relative to the project root — clone your demo/target repo there first.

Start the API server:
```bash
python -m uvicorn app.main:app --reload
```

Start at least one worker (in a separate terminal):
```bash
# macOS only — required to avoid a fork-related segfault (signal 11) in RQ workers:
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

rq worker tasks --worker-class rq.worker.SimpleWorker --url $REDIS_URL
```
Run this command in **multiple terminals** to get genuine parallel execution — each worker process independently pulls jobs off the same `tasks` queue.

### 2. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Using it

1. **Describe a task** in the composer — a specific, scoped instruction (e.g. *"In `src/components/login.jsx`, add a client-side check that the password field is at least 6 characters long"*).
2. **Choose a mode:**
   - **Edit** — the agent will write the change directly on its own branch.
   - **Suggest** — the agent will only propose a change for you to review and apply yourself.
3. **Submit.** The task is queued, picked up by an available worker, and moves through `pending → running → needs_review` (or `failed`, with a full traceback, if something breaks).
4. **Watch the Workers panel** to see which worker is processing which task in real time — this is read directly from RQ/Redis, not inferred.
5. **Open the task** once it's ready for review:
   - Edit mode shows a unified diff of the actual change.
   - Suggest mode shows one card per proposed file change, with the agent's rationale and a side-by-side diff.
6. **Approve or reject.** Nothing is merged, pushed, or applied automatically — this decision is always yours.

---



**Known limitation:** in edit mode, the agent's file changes are currently written to the worktree but not yet committed to the branch. Diff review already works (it reads the uncommitted working-tree diff), but pushing an approved branch to GitHub is blocked until a commit step is added — this is the next piece of work.

Login/signup pages exist as a visual scaffold only; there is no authentication wired up yet.

---

## Why worktrees, and why the review gate

Every task gets a `git worktree` — a second (or third, or tenth) working copy of the same repository, on its own branch, in its own folder, without needing a full re-clone. This is what makes true parallel agent execution safe: two agents can be actively editing files with the same name, in the same repo, at the same time, without ever seeing each other's changes.

The review gate exists because agent-written code is not automatically trustworthy — an agent can produce something that runs but is subtly wrong, over-broad, or stylistically inconsistent with the rest of the codebase. Making review mandatory, and giving developers the choice between edit mode and suggest mode *per task*, keeps a human's judgment in the loop exactly where it matters most, without giving up the speed benefit of running independent tasks concurrently.