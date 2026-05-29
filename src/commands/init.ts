/**
 * Init command — supports multiple agent platforms.
 *
 * Usage:
 *   agentmeter init           — auto-detect and init all available agents
 *   agentmeter init claude-code — init only Claude Code
 *   agentmeter init codex       — init only Codex
 *   agentmeter init --list      — list all supported agents and their status
 */

import { getAllAdapters, getAdapter, detectAvailableAdapters } from "../adapters/index.js";

export function initCommand(args?: { list?: boolean; agent?: string }): void {
  // --list: show all supported agents
  if (args?.list) {
    console.log("");
    console.log("  Supported Agent Platforms");
    console.log("  =========================");
    console.log("");

    const adapters = getAllAdapters();
    for (const adapter of adapters) {
      const installed = adapter.detect();
      const status = installed ? "✅ installed" : "❌ not found";
      console.log(`  ${adapter.id.padEnd(15)} ${adapter.displayName.padEnd(20)} ${status}`);
    }
    console.log("");
    console.log("  Usage: agentmeter init [agent-id]");
    console.log("  Example: agentmeter init claude-code");
    console.log("");
    return;
  }

  // Init specific agent
  if (args?.agent) {
    const adapter = getAdapter(args.agent);
    if (!adapter) {
      console.error(`Unknown agent: ${args.agent}`);
      console.error(`Supported: ${getAllAdapters().map((a) => a.id).join(", ")}`);
      process.exit(1);
    }

    console.log("");
    console.log(`  Initializing ${adapter.displayName}...`);
    console.log("");

    const result = adapter.init();
    if (result.success) {
      console.log(`  ✅ ${result.message}`);
    } else {
      console.log(`  ❌ ${result.message}`);
    }

    if (result.instructions && result.instructions.length > 0) {
      console.log("");
      for (const line of result.instructions) {
        console.log(`  ${line}`);
      }
    }
    console.log("");
    return;
  }

  // Auto-detect and init all available agents
  console.log("");
  console.log("  AgentMeter — Auto-detecting agents...");
  console.log("");

  const available = detectAvailableAdapters();

  if (available.length === 0) {
    console.log("  No supported agents detected.");
    console.log("");
    console.log("  Supported agents:");
    for (const adapter of getAllAdapters()) {
      console.log(`    - ${adapter.displayName} (${adapter.id})`);
    }
    console.log("");
    console.log("  To init a specific agent: agentmeter init <agent-id>");
    console.log("");
    return;
  }

  for (const adapter of available) {
    console.log(`  Found: ${adapter.displayName}`);
    const result = adapter.init();
    if (result.success) {
      console.log(`  ✅ ${result.message}`);
    } else {
      console.log(`  ⚠️  ${result.message}`);
    }
    if (result.instructions && result.instructions.length > 0) {
      for (const line of result.instructions) {
        console.log(`  ${line}`);
      }
    }
    console.log("");
  }

  console.log("  Data will be stored at ~/.agentmeter/meter.db");
  console.log("");
  console.log("  Run 'agentmeter dashboard' to view stats");
  console.log("  Run 'agentmeter stats' for terminal view");
  console.log("");
}
