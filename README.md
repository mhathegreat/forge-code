# KimiStudio

A self-hosted, browser-based **agentic coding IDE** (a Bolt.new / Claude Code clone) powered by **Kimi K2.6** via OpenRouter.

- **Backend** — Node.js + Express + WebSocket (`:4000`): auth, project CRUD, file ops, the agent loop (OpenRouter function-calling), live FS watch, and a real PTY terminal via `node-pty`.
- **Frontend** — Next.js (dark theme) (`:3001`): 4-panel IDE — projects + live file tree sidebar, Monaco editor with tabs, streaming AI chat with tool-call cards, and an Xterm.js terminal. Plus a static preview iframe.
- **Projects** live at `/mnt/data/kimi-projects/<name>/` (the `_kimistudio` app folder is hidden from the project list).
- **Process manager** — PM2 (`ecosystem.config.js`), auto-restart on reboot.

## Run

```bash
# backend
cd backend && npm install
# frontend
cd ../frontend && npm install && npm run build
# both, under pm2 (from the project root)
pm2 start ecosystem.config.js && pm2 save
```

Open **http://192.168.4.21:3001** and log in with the password from `.env` (`APP_PASSWORD`).

## Config (`.env` at project root)

| var | meaning |
|-----|---------|
| `APP_PASSWORD` | single login password |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `KIMI_MODEL` | model id (default `moonshotai/kimi-k2.6`) |
| `PROJECTS_ROOT` | where projects are stored (`/mnt/data/kimi-projects`) |
| `BACKEND_PORT` | backend port (default `4000`) |

## Agent tools

`read_file`, `write_file`, `create_folder`, `run_command`, `list_files`, `delete_file`, `search_files` — all sandboxed to the active project directory (except `run_command`, which runs on the host in the project dir). The agent plans, calls tools in a loop, and updates each project's `AGENTS.md` at the end of a session.
