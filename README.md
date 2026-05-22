<p align="center">
  <img src="assets/logo.svg" alt="AgentMeter" width="340">
</p>

<p align="center">
  <h2 align="center">Token Usage &amp; Cost Tracking for Claude Code</h2>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ymstar/agentmeter"><img src="https://img.shields.io/npm/v/@ymstar/agentmeter?style=flat-square&logo=npm&color=cb3837" alt="npm version"></a>
  <a href="https://github.com/ymstar/agentmeter/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/ymstar/agentmeter/ci.yml?style=flat-square&logo=github&label=CI" alt="CI"></a>
  <a href="https://github.com/ymstar/agentmeter/blob/master/LICENSE"><img src="https://img.shields.io/github/license/ymstar/agentmeter?style=flat-square&color=blue" alt="License"></a>
  <a href="https://github.com/ymstar/agentmeter"><img src="https://img.shields.io/github/stars/ymstar/agentmeter?style=flat-square&logo=github" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Claude_Code-supported-blueviolet.svg" alt="Claude Code"></a>
</p>

---

## Quick Start

```bash
# One command to set up
npx @ymstar/agentmeter init

# Launch dashboard
npx @ymstar/agentmeter dashboard
```

That's it. AgentMeter will automatically track all tool calls in the background.

## Features

- **Zero Config** — One `init` command sets up Claude Code hooks
- **Auto Tracking** — Captures every tool call automatically
- **Beautiful Dashboard** — Dark-themed web UI with charts and sparklines
- **Multi-View** — Analyze by tool, session, model, or agent type
- **Cache Hit Tracking** — Shows cache hit/miss rate per call and in aggregate
- **Multi-Model Pricing** — Built-in pricing for Claude, GPT, Gemini, DeepSeek, MiMo, GLM
- **Effort Tracking** — Records effort level (high/medium/low) per call
- **Budget Alerts** — Set spending limits and get warnings
- **Token Estimation** — Smart 3-layer token counting (parse → estimate → fallback)
- **CJK Aware** — Accurate token estimation for Chinese/Japanese/Korean text
- **Data Export** — Export to CSV or JSON
- **Local Storage** — All data stored locally in SQLite

## Commands

| Command | Description |
|---------|-------------|
| `agentmeter init` | Configure Claude Code hooks (one-time) |
| `agentmeter dashboard` | Launch web dashboard |
| `agentmeter stats` | Show stats in terminal |
| `agentmeter budget` | Check budget status and warnings |
| `agentmeter export` | Export data to CSV or JSON |
| `agentmeter reset` | Clear all recorded data and start fresh |

### `agentmeter dashboard`

```bash
agentmeter dashboard            # default port 3940
agentmeter dashboard --port 8080
```

The dashboard shows:
- Today / Week / Month token usage cards with sparklines
- **Cache Hit Rate** card with hit/miss breakdown
- Token consumption trend chart (7 / 30 / 90 days) with cache read overlay
- Cost by model doughnut chart
- Top tools by token usage doughnut chart
- Hourly activity bar chart
- **By Tool** — Statistics grouped by tool name
- **By Session** — Statistics grouped by Claude Code session
- **By Model** — Statistics grouped by LLM model
- **By Agent** — Statistics grouped by agent type
- **Recent Calls** — Each call shows model, effort level, cache hit rate, and cost

### `agentmeter export`

```bash
agentmeter export                        # CSV to stdout, last 30 days
agentmeter export -f json -o data.json   # JSON to file
agentmeter export -d 7                   # Last 7 days
```

### `agentmeter budget`

```bash
agentmeter budget
```

Shows daily and monthly spending against configured limits.

### `agentmeter reset`

```bash
agentmeter reset          # prompts for confirmation
agentmeter reset --force  # skip confirmation
```

## Configuration

AgentMeter stores config at `~/.agentmeter/config.json`:

```json
{
  "daily_limit_usd": 10,
  "monthly_limit_usd": 100,
  "daily_limit_tokens": 5000000,
  "monthly_limit_tokens": 50000000,
  "warn_at_percent": 80
}
```

## How It Works

1. `agentmeter init` adds a `PostToolUse` hook to `~/.claude/settings.json`
2. Every time Claude Code uses a tool, the hook fires and captures the call
3. AgentMeter parses token usage, detects model & agent type, estimates cost
4. Data is stored in `~/.agentmeter/meter.db` (SQLite)
5. View stats via `agentmeter dashboard` or `agentmeter stats`

## Model Detection

AgentMeter auto-detects the model from Claude Code's environment:

1. Hook input field → 2. Environment variables (`ANTHROPIC_MODEL`, `CLAUDE_MODEL`, `OPENAI_MODEL`) → 3. `~/.claude/settings.json` → 4. Default to Claude Sonnet

Agent type detection (identifies Claude Code):

1. `CLAUDECODE` env var → 2. `CLAUDE_CODE_SESSION_ID` env var → 3. Session ID format → 4. `~/.claude` directory → 5. Model name pattern

## Cache Token Tracking

When Claude Code uses prompt caching, the API returns `cache_creation_input_tokens` and `cache_read_input_tokens`. AgentMeter captures these and calculates:

- **Cache Hit Rate** — percentage of input tokens served from cache
- **Cache-aware cost** — cache reads are cheaper (e.g., Claude: 0.1x input price)

## Model Pricing

Built-in per-1M-token pricing (input / output / cache read / cache write):

| Model Family | Models | Input | Output |
|-------------|--------|-------|--------|
| **Claude** | Opus 4, Sonnet 4, 3.5 Sonnet, 3.5 Haiku, 3 Opus | $0.8–$15 | $4–$75 |
| **GPT** | 4o, 4o-mini, 4-turbo, 3.5-turbo | $0.15–$10 | $0.6–$30 |
| **Gemini** | 2.5 Pro, 2.5 Flash, 2.0 Flash | $0.1–$1.25 | $0.4–$10 |
| **DeepSeek** | v4-flash, v4-pro, v3.2, r1 | $0.14–$1.74 | $0.28–$3.48 |
| **MiMo** | v2.5-pro, v2.5, v2-flash | $0.1–$1 | $0.3–$3 |
| **GLM** | 5.1, 5, 4.7, 4.7-flash, 4.5-air | $0.06–$1.2 | $0.4–$4 |

Unknown models default to Claude Sonnet pricing.

## Supported Agents

- **Claude Code** — fully supported via `PostToolUse` hook
- Cursor / Gemini CLI / others — not yet supported, contributions welcome

## Development

```bash
git clone https://github.com/ymstar/agentmeter.git
cd agentmeter
npm install
npm run build
npm test
```

No linter configured — CI type-checks with `npx tsc --noEmit` on Node 20 and 22.

## License

[MIT](LICENSE)
