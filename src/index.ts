#!/usr/bin/env node

import { parseArgs } from "node:util";
import { initCommand } from "./commands/init.js";
import { hookCommand } from "./commands/hook.js";
import { statsCommand } from "./commands/stats.js";
import { dashboardCommand } from "./dashboard/server.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p" },
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
      hookCommand();
      break;

    case "stats":
      statsCommand();
      break;

    case "dashboard":
      dashboardCommand({
        port: values.port ? parseInt(values.port as string, 10) : 3940,
      });
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
    hook         Internal: called by Claude Code hooks

  Options:
    -p, --port <port>    Dashboard port (default: 3940)
    -h, --help           Show this help

  Quick Start:
    npx @ymstar/agentmeter init
    npx @ymstar/agentmeter dashboard
  `);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
