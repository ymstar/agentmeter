# Contributing to AgentMeter

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/ymstar/agentmeter.git
cd agentmeter
npm install
npm run build
npm test
```

## Project Structure

```
src/
├── index.ts              # CLI entry
├── commands/             # CLI commands (init, hook, stats, export)
├── db/                   # SQLite database
├── token/                # Token counting & pricing
└── dashboard/            # Web dashboard (server + static files)
```

## Commands

- `npm run build` — Compile TypeScript
- `npm test` — Run tests
- `npm run dev` — Watch mode

## Adding Features

1. Create a branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add tests if applicable
4. Run `npm test` to verify
5. Submit a pull request

## Code Style

- TypeScript strict mode
- ES modules (import/export)
- No external linting tools (keep it simple)
- Prefer readability over cleverness

## Reporting Issues

Open an issue on GitHub with:
- What you expected
- What happened
- Steps to reproduce
