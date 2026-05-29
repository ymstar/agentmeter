/**
 * Adapter registry.
 * Manages all available agent adapters.
 */

import type { AgentAdapter } from "./types.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";

const adapters: Map<string, AgentAdapter> = new Map();

// Register all built-in adapters
const builtIn = [new ClaudeCodeAdapter(), new CodexAdapter()];
for (const adapter of builtIn) {
  adapters.set(adapter.id, adapter);
}

/** Get adapter by ID */
export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.get(id);
}

/** Get all registered adapters */
export function getAllAdapters(): AgentAdapter[] {
  return Array.from(adapters.values());
}

/** Detect which agents are available in the current environment */
export function detectAvailableAdapters(): AgentAdapter[] {
  return getAllAdapters().filter((a) => a.detect());
}

/** Get list of all supported adapter IDs */
export function getSupportedAgentIds(): string[] {
  return Array.from(adapters.keys());
}
