<pre align="center">
    _                    __  __
   / \   _ __ ___  __ _|  \/  | ___ _ __ ___   ___
  / _ \ | '_ ` _ \/ _` | |\/| |/ _ \ '_ ` _ \ / _ \
 / ___ \| | | | | | (_| | |  | |  __/ | | | | |  __/
/_/   \_\_| |_| |_|\__,_|_|  |_|\___|_| |_| |_|\___|
</pre>

<p align="center">
  <strong>Token Usage Tracking for AI Agents</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ymstar/agentmeter"><img src="https://img.shields.io/npm/v/@ymstar/agentmeter?style=flat-square&logo=npm&color=cb3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@ymstar/agentmeter"><img src="https://img.shields.io/npm/dt/@ymstar/agentmeter?style=flat-square&logo=npm&color=cb3837" alt="npm downloads"></a>
  <a href="https://github.com/ymstar/agentmeter/blob/master/LICENSE"><img src="https://img.shields.io/github/license/ymstar/agentmeter?style=flat-square&color=blue" alt="License"></a>
</p>

---

AgentMeter automatically tracks token consumption for AI agents (Claude Code, etc.) with a beautiful web dashboard.

## Quick Start

```bash
# One command to set up
npx @ymstar/agentmeter init

# Launch dashboard
npx @ymstar/agentmeter dashboard
```

That's it. AgentMeter will automatically track all tool calls in the background.

## Features

- **Zero Config** - One `init` command sets up Claude Code hooks
- **Auto Tracking** - Captures every tool call automatically
- **Beautiful Dashboard** - Dark-themed web UI with charts
- **Token Estimation** - Smart token counting with fallback estimation
- **Cost Calculation** - Estimates cost based on model pricing
- **Local Storage** - All data stored locally in SQLite

## Commands

| Command | Description |
|---------|-------------|
| `agentmeter init` | Configure Claude Code hooks (one-time) |
| `agentmeter dashboard` | Launch web dashboard |
| `agentmeter stats` | Show stats in terminal |

## Dashboard

```bash
agentmeter dashboard --port 3940
```

The dashboard shows:
- Today/Week/Month token usage cards
- Token consumption trend chart (7/30/90 days)
- Top tools by token usage
- Recent tool calls table

## How It Works

1. `agentmeter init` adds a PostToolUse hook to Claude Code
2. Every time Claude Code uses a tool, the hook captures the call
3. AgentMeter records token usage, duration, and estimated cost
4. Data is stored in `~/.agentmeter/meter.db` (SQLite)

## Token Counting

AgentMeter uses a three-layer strategy:

1. **Parse** - Extract `usage` from MCP response if available
2. **Estimate** - Use tokenizer approximation (4 chars ≈ 1 token)
3. **Fallback** - Character-based estimation

## Model Pricing

Built-in pricing for:
- Claude (Opus, Sonnet, Haiku)
- GPT (4o, 4o-mini, 4-turbo, 3.5-turbo)
- Gemini (2.5 Pro, 2.5 Flash, 2.0 Flash)

## Development

```bash
git clone https://github.com/ymstar/agentmeter.git
cd agentmeter
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)
