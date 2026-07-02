# Forge

A self-hosted, browser-based **AI coding studio** — an open-source Bolt.new / Claude Code style agentic IDE that runs entirely on your own machine. Pick any model on OpenRouter (including free ones), describe what you want, and Forge plans, writes files, runs commands, and verifies the result — with a permission system so it only does what you allow.

## Features

- **4-panel IDE** — project & live file-tree sidebar, Monaco editor with tabs, streaming agent chat, real PTY terminal (xterm.js)
- **Autonomous agent loop** — 7 tools (read/write/create/delete/list/search/run_command), plan → act → observe until done
- **Any OpenRouter model** — searchable picker over the full catalog with pricing and a *Free only* filter; per-project model override
- **Claude Code–style permissions** — three modes per project: **Ask first** (approve writes & commands), **Auto edits** (approve only commands/deletes), **Full auto**; approve inline with *Allow / Always allow / Deny*
- **Real memory** — full chat history per project, editable `AGENTS.md` persistent memory, and **automatic context compaction** (older conversation is summarized into rolling session memory so long sessions never lose the thread)
- **Static preview** — one-click preview of `index.html`-based projects
- **PWA** — open `http://localhost:3001` in Chrome and “Install app” to run Forge in its own window

## Requirements

- Node.js 20+ (22 recommended)
- An [OpenRouter](https://openrouter.ai) API key
- Windows, macOS, or Linux (on Windows, Git Bash is auto-detected and used as the agent/terminal shell)

## Quick start

```bash
# 1. configure
cp .env.example .env     # then edit: set APP_PASSWORD and OPENROUTER_API_KEY

# 2. install + build (one time)
npm run setup

# 3. run
npm start
```

Open **http://localhost:3001**, log in with your `APP_PASSWORD`, create a project, and tell the agent what to build.

For development with hot reload: `npm run dev`.

## Configuration (`.env`)

| var | meaning | default |
|-----|---------|---------|
| `APP_PASSWORD` | login password | *(required)* |
| `OPENROUTER_API_KEY` | OpenRouter key | *(required)* |
| `DEFAULT_MODEL` | default model id | `moonshotai/kimi-k2.6` |
| `PROJECTS_ROOT` | where projects live | `./projects` |
| `BACKEND_PORT` | backend port | `4000` |
| `FORGE_SHELL` | override shell path | auto (Git Bash → PowerShell) |

Global runtime settings (default model / permission mode) persist in `settings.json`; per-project overrides live in each project's `meta.json`.

## Architecture

- **backend/** — Express + WebSocket (`:4000`): auth, project/file APIs, the agent loop (OpenRouter function-calling with streaming), approval broker, session-memory compactor, chokidar live file watch, and a real PTY via `@lydell/node-pty` (prebuilt — no compiler needed).
- **frontend/** — Next.js 14 dark-theme IDE (`:3001`): Monaco, xterm.js, model picker, approval cards, memory panel.
- **projects/** — your projects (gitignored). Each contains `meta.json`, `AGENTS.md`, `chat.json`, `memory.json` plus the code the agent writes.

## Safety notes

- File tools are sandboxed to the active project directory. `run_command` runs real shell commands in the project folder — that's the point — so keep permission mode on **Ask first** when trying untrusted prompts.
- The login cookie is derived from your password; anyone on your LAN who knows the password can use the app. Don't expose the ports to the internet without adding TLS + proper auth.
