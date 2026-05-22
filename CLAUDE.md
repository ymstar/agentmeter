# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AgentMeter?

AgentMeter (`@ymstar/agentmeter`) is a CLI that tracks token consumption for AI agents (Claude Code, Cursor, Gemini CLI). It hooks into Claude Code's `PostToolUse` event to capture every tool call, records token usage and estimated costs into a local SQLite database, and provides terminal stats, a web dashboard, CSV/JSON export, and budget alerts.

## Commands

```bash
npm run build          # Compile TypeScript to dist/ + copy dashboard static assets
npm run test           # Run all tests (vitest run)
npm run dev            # Watch mode compilation (tsc --watch)
npx tsc --noEmit       # Type-check only (used in CI lint job)
```

There is no linter or formatter configured. CI type-checks with `npx tsc --noEmit` on Node 20 and 22.

## Architecture

**ES modules** (`"type": "module"` in package.json). Target ES2022 with Node16 module resolution.

### Data Flow

1. `init` command writes a `PostToolUse` hook into `~/.claude/settings.json` that runs `npx -y @ymstar/agentmeter hook`
2. Claude Code fires the hook after every tool use, passing tool name, input, response, session_id, model, agent_type, cwd via stdin JSON
3. `hook` command parses stdin, detects model/agent type via fallback chains, estimates tokens (three-layer: parse MCP usage fields → estimate from text at 4 chars/token ASCII, 2 chars/token CJK → character count), calculates cost, inserts into SQLite
4. SQLite lives at `~/.agentmeter/meter.db`

### Key Modules

- **`src/index.ts`** — CLI entry point using `node:util` `parseArgs`. Routes to: `init`, `hook`, `stats`, `dashboard`, `budget`, `export`
- **`src/commands/hook.ts`** — Core data collection. Contains `detectModel()` (input → env vars → settings file → default Sonnet) and `detectAgentType()` (input → env vars → UUID pattern → `~/.claude` existence)
- **`src/db/client.ts`** — `MeterDB` class wrapping `better-sqlite3`. Single `tool_calls` table with migration support (adds columns via `ALTER TABLE` based on `PRAGMA table_info`). WAL mode enabled
- **`src/token/pricing.ts`** — Hardcoded `MODEL_PRICING` table for Claude, GPT, and Gemini models. Unknown models default to Claude Sonnet pricing
- **`src/dashboard/server.ts`** — Raw `node:http` server (no framework). REST API at `/api/overview`, `/api/daily`, `/api/tools`, `/api/sessions`, `/api/models`, `/api/agents`, `/api/calls`. Default port 3940

### Config Paths

| Path | Purpose | Managed by |
|------|---------|------------|
| `~/.claude/settings.json` | Claude Code settings (hook injection) | `init` command |
| `~/.agentmeter/meter.db` | SQLite database | `hook`, `stats`, `export`, `budget`, `dashboard` |
| `~/.agentmeter/config.json` | Budget limits | `budget` command |

### Conventions

- **No external framework dependencies.** HTTP server is raw `node:http`, CLI parser is `node:util` `parseArgs`, dashboard frontend loads Chart.js from CDN
- **Synchronous SQLite.** All DB operations use synchronous `better-sqlite3`. The `main()` in index.ts is async but command handlers are synchronous
- **DB_PATH is duplicated** across `hook.ts`, `stats.ts`, `export.ts`, `budget.ts`, and `dashboard/server.ts` — each defines `const DB_PATH = join(homedir(), ".agentmeter", "meter.db")`
- **Build copies static assets** — `npm run build` runs `tsc` then `cp -r src/dashboard/static dist/dashboard/` to include the frontend files in dist

## Testing

Tests are in `tests/` using Vitest. Four test files: `db.test.ts`, `token.test.ts`, `budget.test.ts`, `export.test.ts`.

```bash
npm run test              # Run all tests
npx vitest run tests/db.test.ts   # Run a single test file
```
