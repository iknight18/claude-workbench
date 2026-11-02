# Claude Workbench

A local-first web application for AI-assisted development. Centralized workspace for prompt engineering, session management, scheduled tasks, and Claude profile management.

## Project Structure

Turborepo monorepo with npm workspaces:

```
claude-workbench/
├── client/          # Next.js 16 frontend (App Router, Tailwind v4)
├── server/          # Express.js backend (TypeScript, SQLite)
├── docker/          # Docker entrypoint script
├── docs/            # Presentation page
├── projects/        # Test projects (mounted as /workspace in Docker)
├── scripts/         # Production startup (start-prod.js)
├── Dockerfile       # Multi-stage build (node:22-slim)
├── docker-compose.yml
├── turbo.json       # Turborepo task config
└── package.json     # Root workspace (npm workspaces)
```

## Running

```bash
npm run dev          # Starts both servers via Turborepo (local dev)
docker compose up    # Docker deployment
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:4201

**Never use default ports (3000, 3001, 8080).** Current ports are 4200/4201.

### Docker Deployment

- **Dockerfile**: Multi-stage build. Stage 1 builds server + client. Stage 2 runtime with Node 22, git, Claude CLI (`@anthropic-ai/claude-code`).
- **docker-compose.yml**: Mounts `./projects:/workspace`, persists data in `dashboard-data:/data` volume.
- **docker/entrypoint.sh**: Creates data dirs, starts backend + frontend, graceful shutdown.
- **Environment**: `DATA_DIR=/data` switches DB path and profile directory. `IS_SANDBOX=1` set in Docker.
- **LAN mode**: Set `NETWORK=true` for HTTPS + LAN IP access (for mobile/voice input secure context).

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, CodeMirror 6, Phosphor Icons, Geist font, xterm.js
- **Backend**: Express.js, TypeScript, better-sqlite3, node-pty, node-cron, uuid
- **Monorepo**: Turborepo + npm workspaces

### Important: Next.js 16 + Tailwind v4

- Tailwind v4 does NOT use `tailwind.config.ts`. Config lives in `@theme` blocks inside `client/app/globals.css`
- Next.js 16 has breaking changes — check `client/node_modules/next/dist/docs/` for API reference
- Use `@import "tailwindcss"` not `@tailwind base/components/utilities`

## Aesthetic Direction

**Matte Industrial** — clean, precise, utilitarian.

- **Palette**: Zinc-950 background, Zinc-900 sidebar, Zinc-800/700 borders, Emerald-500 accent (single accent color)
- **Typography**: Geist Sans for UI, Geist Mono for code/editor. `tracking-tight` on headings
- **Surfaces**: Subtle 1px borders (`border-zinc-800`), no card shadows. Dark mode only
- **Icons**: Phosphor Icons, stroke weight 1.5

## Architecture

### Backend (`server/`)

Modular structure — each feature is self-contained:

```
server/
├── index.ts                 # Express app, CORS, HTTP/HTTPS servers, route registration
├── config/index.ts          # Port (4201), CORS, DB path, Docker/network detection
├── db/
│   ├── connection.ts        # SQLite singleton (WAL, foreign keys ON)
│   └── migrations/          # 16 numbered SQL migration files
├── modules/
│   ├── prompts/             # routes.ts, service.ts, types.ts
│   ├── sessions/            # routes.ts, service.ts, types.ts
│   ├── tags/                # routes.ts, service.ts
│   ├── terminal/            # manager.ts, routes.ts, websocket.ts
│   ├── scheduler/           # engine.ts, routes.ts, service.ts, types.ts
│   ├── notifications/       # hooks.ts, routes.ts, service.ts, types.ts, websocket.ts
│   ├── profiles/            # routes.ts, service.ts, types.ts
│   ├── processes/           # routes.ts, service.ts
│   ├── filesystem/          # routes.ts
│   ├── dashboard/           # routes.ts, service.ts
│   └── network/             # config.ts (LAN IP, HTTPS certs)
└── shared/
    ├── middleware/           # Error handler
    └── utils/               # UUID generation
```

**Adding a new module**: Create `server/modules/<name>/` with routes, service, types. Add migration file. Register router in `index.ts`.

### Frontend (`client/`)

Uses Next.js 16 route groups for layout separation:

```
client/
├── app/
│   ├── layout.tsx                      # Root layout
│   ├── globals.css                     # Tailwind v4 config + theme
│   ├── (dashboard)/layout.tsx          # Main app layout with Sidebar
│   │   ├── page.tsx                    # Home dashboard (bento tiles)
│   │   ├── prompts/page.tsx            # Prompt management
│   │   ├── sessions/page.tsx           # Session management
│   │   ├── schedules/page.tsx          # Scheduled tasks
│   │   └── settings/page.tsx           # Profile & hook management
│   ├── (command-center)/layout.tsx     # Popup layout
│   │   └── command-center/page.tsx     # Command palette
│   └── (popup)/layout.tsx              # Minimal popup layout
│       └── activity/page.tsx           # Activity/notification view
├── components/
│   ├── shell/               # Sidebar, DashboardHome
│   ├── prompts/             # PromptList, PromptEditor, TagEditor, etc.
│   ├── sessions/            # SessionList, SessionListItem, SessionEditor
│   ├── schedules/           # Scheduler UI components
│   ├── settings/            # Profile management UI
│   ├── command-center/      # Command palette components
│   └── shared/              # SearchInput, EmptyState
└── lib/
    ├── api/                 # client.ts, prompts.ts, sessions.ts, scheduler.ts,
    │                        # notifications.ts, profiles.ts, processes.ts, dashboard.ts
    ├── hooks/               # usePrompts, useSessions, useScheduler, useProfiles,
    │                        # useKeyboardShortcuts
    └── contexts/            # NavigationGuardContext, NotificationContext, TerminalContext
```

**Adding a new module**: Create route in `app/(dashboard)/<name>/page.tsx`, components in `components/<name>/`, API client in `lib/api/<name>.ts`, hooks in `lib/hooks/`.

### API Endpoints

All responses: `{ data: T }` for success, `{ error: string }` for errors.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Health check |
| **Prompts** | | |
| GET | `/api/prompts` | List (supports `?search=`, `?tag=`) |
| GET | `/api/prompts/:id` | Get single prompt with tags |
| POST | `/api/prompts` | Create |
| PUT | `/api/prompts/:id` | Update (auto-creates version snapshot, 30s throttle) |
| DELETE | `/api/prompts/:id` | Delete (cascades tags + versions) |
| GET | `/api/prompts/:id/versions` | Version history |
| POST | `/api/prompts/:id/versions/:vid/restore` | Restore version |
| POST | `/api/prompts/:id/enhance` | Enhance prompt via Claude CLI |
| GET | `/api/tags` | List all unique tags |
| **Sessions** | | |
| GET | `/api/sessions` | List (supports `?search=`, `?tag=`, `?status=`) |
| GET | `/api/sessions/:id` | Get single session with tags + git branch |
| POST | `/api/sessions` | Create |
| PUT | `/api/sessions/:id` | Update |
| DELETE | `/api/sessions/:id` | Delete (cascades tags, kills terminal) |
| GET | `/api/sessions/directories` | Distinct directories for autocomplete |
| GET | `/api/sessions/groups` | Distinct groups for autocomplete |
| GET | `/api/sessions/tags` | Session-specific tags |
| POST | `/api/sessions/:id/terminal` | Start terminal for session |
| DELETE | `/api/sessions/:id/terminal` | Kill terminal for session |
| GET | `/api/sessions/:id/terminal/status` | Check terminal status |
| POST | `/api/sessions/:id/terminal/input` | Send input to terminal |
| POST | `/api/sessions/:id/hooks` | Toggle project-level hooks |
| **Terminals** | | |
| GET | `/api/terminals/active` | List session IDs with running terminals |
| GET | `/api/terminals/:sessionId/preview` | Last 3 lines of terminal output |
| **Profiles** | | |
| GET | `/api/profiles` | List all profiles |
| GET | `/api/profiles/:id` | Get single profile |
| POST | `/api/profiles` | Create profile |
| PUT | `/api/profiles/:id` | Update profile |
| DELETE | `/api/profiles/:id` | Delete profile (`?mode=disk` for full delete) |
| GET | `/api/profiles/:id/config` | Get CLAUDE.md and settings.json |
| PUT | `/api/profiles/:id/config` | Write CLAUDE.md and settings.json |
| GET | `/api/profiles/:id/skills` | List skills for profile |
| **Scheduler** | | |
| GET | `/api/scheduler/tasks` | List all scheduled tasks |
| GET | `/api/scheduler/tasks/running` | List currently running tasks |
| GET | `/api/scheduler/tasks/:id` | Get single task with runs |
| POST | `/api/scheduler/tasks` | Create task (cron or one-shot) |
| PUT | `/api/scheduler/tasks/:id` | Update task |
| DELETE | `/api/scheduler/tasks/:id` | Delete task |
| POST | `/api/scheduler/tasks/:id/run` | Manually run task |
| GET | `/api/scheduler/tasks/:id/runs` | List task run history |
| **Filesystem** | | |
| GET | `/api/filesystem/browse` | Browse directories (`?path=`) |
| POST | `/api/filesystem/mkdir` | Create directory |
| **Processes** | | |
| GET | `/api/processes/claude` | Scan running Claude processes |
| POST | `/api/processes/claude/kill` | Kill Claude processes (optional `pids` array) |
| **Dashboard** | | |
| GET | `/api/dashboard/stats` | Aggregate stats for home dashboard |
| **Notifications** | | |
| GET | `/api/notifications` | List (supports `?unread=true`, `?limit=`) |
| GET | `/api/notifications/unread-count` | Unread count for badge |
| POST | `/api/notifications/create` | Create notification directly |
| POST | `/api/notifications/hook` | Receive Claude hook POST events |
| PUT | `/api/notifications/read-all` | Mark all as read |
| PUT | `/api/notifications/:id/read` | Mark one as read |
| DELETE | `/api/notifications/clear` | Clear all notifications |
| DELETE | `/api/notifications/:id` | Delete one notification |
| GET | `/api/notifications/hooks/status` | Which profiles have hooks enabled |
| POST | `/api/notifications/hooks/enable/:profile` | Inject hooks into profile |
| POST | `/api/notifications/hooks/disable/:profile` | Remove hooks from profile |
| **WebSockets** | | |
| WS | `/ws/terminal/:sessionId` | Terminal I/O per session |
| WS | `/ws/notifications` | Real-time notification broadcast |

### Database (SQLite)

Tables: `prompts`, `prompt_tags`, `prompt_versions`, `sessions`, `session_tags`, `scheduled_tasks`, `scheduled_task_runs`, `notifications`, `notification_settings`, `profiles`. UUIDs as primary keys. Foreign keys with CASCADE delete.

Notable session columns: `profile`, `skip_permissions`, `group`, `hooks_enabled`, `claude_session_id`.

## Implemented Features

### Application Shell
- Icon sidebar (48px) with nav items + active route detection (emerald highlight)
- Bento-style home dashboard with module tiles and aggregate stats
- Route groups: `(dashboard)` for main app, `(command-center)` for command palette, `(popup)` for activity view

### Prompt Management
- CRUD with instant create (no modal)
- CodeMirror 6 editor with Markdown syntax + `{{variable}}` highlighting in emerald
- Tag system: separate table, filter chips, editor with autocomplete
- Auto-save (1.5s debounce) with "Saving"/"Saved" indicator
- Version history: snapshots on save (30s throttle), right-side drawer, preview + restore
- AI enhancement: sends prompt to Claude CLI with meta-prompt, saves version before enhancing
- Collapsible notes panel per prompt
- Search (debounced, client-side)
- Inline delete confirmation
- Keyboard shortcuts: Ctrl+N (new), Ctrl+S (save), Ctrl+Shift+H (history), Escape (close)

### Session Management
- CRUD with instant create
- Project directory association with autocomplete and filesystem browser
- Live git branch display (read from directory, 5s cache)
- Status tracking: active, completed, archived with click-to-cycle badge
- Status-filtered list view with tabs
- Session grouping
- Tag system (shared with prompts)
- Collapsible notes panel
- Search (debounced, client-side)
- Inline delete confirmation
- Manual save with dirty tracking and navigation guard
- Keyboard shortcuts: Ctrl+N (new), Ctrl+S (save), Escape (deselect)
- Embedded terminal per session via xterm.js + node-pty + WebSocket
- Manual terminal start/stop/restart via toolbar buttons
- Terminal persists in background when switching sessions
- 50KB rolling output buffer replayed on reconnect
- Terminal indicator and output preview on session list items
- Session deletion kills any running terminal
- Claude profile selector per session
- Profile sets CLAUDE_CONFIG_DIR on terminal spawn
- Skip-permissions toggle per session
- Session continue (`--continue`) after first run
- Per-session project-level hook toggle
- Collapsible tools panel with Prompts/Skills/Config tabs
- Prompt picker with search, variable substitution, copy and insert to terminal
- Skills viewer reads skills from selected profile, insert slash commands
- Config viewer shows read-only CLAUDE.md and settings.json

### Scheduled Tasks
- Create cron-based or one-shot scheduled tasks
- Tasks execute Claude CLI with prompt via `spawn` (no shell dependency)
- Optional session association (uses `--name` and `--continue`)
- Profile support per task
- Run history with exit codes, stdout, token usage, cost tracking
- Manual run trigger
- Enable/disable toggle
- Completion/failure auto-emits notifications

### Profile Management
- Auto-discovery of Claude profiles from filesystem
- CRUD for profiles (create, rename, delete with disk cleanup option)
- Per-profile config viewer/editor (CLAUDE.md + settings.json)
- Skills listing per profile
- Sign-in status per profile; sign in with `CLAUDE_CONFIG_DIR=<profile dir> claude` then `/login`
- Profile wrapper scripts generated in Docker (`/usr/local/bin/claude-{name}`)

### Notifications
- Bell icon in sidebar with unread count badge
- Dropdown popover with notification list, mark-read, clear-all
- Real-time updates via dedicated WebSocket (`/ws/notifications`)
- Claude hook integration: Stop, Notification (permission_prompt, idle_prompt), TaskCreated, TaskCompleted
- Per-profile hook enable/disable toggle in Settings page
- Per-session project-level hook toggle
- Safe hook injection: only adds/removes entries matching dashboard URL
- Scheduler task completion/failure auto-emits notifications
- SQLite persistence across server restarts

### Process Management
- Scan running Claude processes on host
- Kill orphaned Claude processes (bulk or by PID)
- Auto-cleanup of orphaned processes on server startup

### Command Center
- Command palette popup for quick actions

### Network / LAN Mode
- `NETWORK=true` enables LAN access
- Auto-detects LAN IP, adds to CORS origins
- Self-signed HTTPS certificates for secure context (voice input on mobile)
