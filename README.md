# Claude Workbench

A local web workspace for working with [Claude Code](https://docs.claude.com/en/docs/claude-code/overview):
run sessions in browser terminals, keep a library of prompts, schedule headless runs, and switch between
several Claude Code profiles, all from one place.

It runs on your machine and drives the Claude Code CLI you already have installed, under your own login.
It is a personal project, not affiliated with or endorsed by Anthropic.

## What it does

- **Sessions.** Each session is tied to a project folder and gets its own terminal (xterm.js, node-pty,
  WebSocket). Terminals keep running when you switch away and replay their recent output when you come
  back. A side panel inserts prompts, skills and slash commands straight into the terminal.
- **Prompts.** A Markdown editor (CodeMirror 6) with `{{variable}}` slots, tags, auto-save and version
  history. One click asks Claude to improve a prompt, saving a version first.
- **Scheduled tasks.** Cron or one-shot runs of the Claude CLI, with run history, exit codes, token usage
  and cost.
- **Profiles.** Several Claude Code config directories side by side (`CLAUDE_CONFIG_DIR`), each with its own
  CLAUDE.md, settings and skills, editable from the UI. Pick a profile per session or task.
- **Notifications.** Claude Code hooks (Stop, Notification, task events) feed a live notification bell, so
  you know when a session is waiting for you.
- **Housekeeping.** Find and kill orphaned Claude processes; LAN mode with HTTPS for using it from a phone.

## Run it

Needs Node.js 22 and the Claude Code CLI (`npm install -g @anthropic-ai/claude-code`).

```bash
npm install
npm run dev
```

The UI is on http://localhost:4200 and the API on http://localhost:4201. For a production build, use
`./start.sh` (or `start.bat` on Windows).

With Docker, copy `.env.example` to `.env`, then:

```bash
docker compose up
```

Projects mounted at `./projects` show up under `/workspace`, and profiles live in `./profiles`.

### Signing in

Workbench never handles your Claude credentials. To sign a profile in, run Claude Code against that profile's
folder and log in there:

```bash
CLAUDE_CONFIG_DIR=/path/to/.claude-work claude
```

then type `/login`. The profile card in Settings shows whether each profile is signed in.

## Security

Workbench starts shells and runs Claude Code with the permissions of the user running it, including an
optional skip-permissions mode. There is no authentication on the UI. Keep it on `localhost` or a network
you trust, and never expose it to the internet.

## Stack

Next.js 16, React 19, Tailwind CSS v4 and xterm.js on the front; Express, better-sqlite3, node-pty and
node-cron on the back; Turborepo and npm workspaces around both.

## Licence

[MIT](LICENSE).
