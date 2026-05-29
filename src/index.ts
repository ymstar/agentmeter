#!/usr/bin/env node

import { parseArgs } from "node:util";
import { initCommand } from "./commands/init.js";
import { hookCommand } from "./commands/hook.js";
import { statsCommand } from "./commands/stats.js";
import { exportCommand } from "./commands/export.js";
import { budgetCommand } from "./commands/budget.js";
import { dashboardCommand } from "./dashboard/server.js";
import { resetCommand } from "./commands/reset.js";
import { debugCommand } from "./commands/debug.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p" },
    format: { type: "string", short: "f" },
    output: { type: "string", short: "o" },
    days: { type: "string", short: "d" },
    force: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0] ?? "help";

if (values.help && command === "help") {
  printHelp();
  process.exit(0);
}

async function main() {
  switch (command) {
    case "init":
      initCommand();
      break;

    case "hook":
      await hookCommand();
      break;

    case "stats":
      statsCommand();
      break;

    case "export":
      exportCommand({
        format: values.format as string | undefined,
        output: values.output as string | undefined,
        days: values.days as string | undefined,
      });
      break;

    case "budget":
      budgetCommand();
      break;

    case "dashboard":
      dashboardCommand({
        port: values.port ? parseInt(values.port as string, 10) : 3940,
      });
      break;

    case "reset":
      await resetCommand({ force: !!values.force });
      break;

    case "debug":
      debugCommand();
      break;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
  AgentMeter - Token Usage Tracking for AI Agents

  Usage:
    agentmeter <command> [options]

  Commands:
    init         Configure Claude Code hooks (one-time setup)
    stats        Show token usage statistics in terminal
    dashboard    Launch web dashboard (default port 3940)
    budget       Check budget status and warnings
    export       Export data to CSV or JSON
    reset        Clear all recorded data and start fresh
    debug        Show model detection debug info
    hook         Internal: called by Claude Code hooks

  Options:
    -p, --port <port>      Dashboard port (default: 3940)
    -f, --format <format>  Export format: csv (default), json
    -o, --output <file>    Output file (default: stdout)
    -d, --days <n>         Number of days to export (default: 30)
    -h, --help             Show this help

  Quick Start:
    npx @ymstar/agentmeter init
    npx @ymstar/agentmeter dashboard
    npx @ymstar/agentmeter export -f csv -o data.csv
  `);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
