/**
 * Claude Code adapter.
 * Integrates via PostToolUse hook in ~/.claude/settings.json.
 * Claude Code passes tool call data as JSON via stdin to the hook command.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, InitResult, ParsedToolCall } from "./types.js";

export class ClaudeCodeAdapter implements AgentAdapter {
  id = "claude-code";
  displayName = "Claude Code";

  detect(): boolean {
    return existsSync(join(homedir(), ".claude"));
  }

  init(): InitResult {
    const settingsPath = join(homedir(), ".claude", "settings.json");

    if (!existsSync(settingsPath)) {
      return {
        success: false,
        message: "Claude Code settings not found at ~/.claude/settings.json",
        instructions: ["Please run Claude Code first, then try again."],
      };
    }

    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
    } catch {
      return { success: false, message: "Failed to parse settings.json" };
    }

    if (!settings.hooks) settings.hooks = {};
    const hooks = settings.hooks as Record<string, unknown>;

    const hookEntry = {
      matcher: ".*",
      hooks: [
        {
          type: "command",
          command: "npx -y @ymstar/agentmeter hook",
        },
      ],
    };

    if (!hooks.PostToolUse) {
      hooks.PostToolUse = [hookEntry];
    } else {
      const postToolUse = hooks.PostToolUse as Array<Record<string, unknown>>;
      const exists = postToolUse.some(
        (h) =>
          h.hooks &&
          Array.isArray(h.hooks) &&
          h.hooks.some(
            (hook: Record<string, unknown>) =>
              typeof hook.command === "string" && hook.command.includes("agentmeter"),
          ),
      );
      if (!exists) {
        postToolUse.push(hookEntry);
      }
    }

    settings.hooks = hooks;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

    return {
      success: true,
      message: "PostToolUse hook added to ~/.claude/settings.json",
    };
  }

  uninstall(): void {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (!existsSync(settingsPath)) return;

    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (!hooks?.PostToolUse) return;

      const postToolUse = hooks.PostToolUse as Array<Record<string, unknown>>;
      hooks.PostToolUse = postToolUse.filter(
        (h) =>
          !(
            h.hooks &&
            Array.isArray(h.hooks) &&
            h.hooks.some(
              (hook: Record<string, unknown>) =>
                typeof hook.command === "string" && hook.command.includes("agentmeter"),
            )
          ),
      );

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    } catch {
      // ignore
    }
  }

  parseInput(raw: unknown): ParsedToolCall | null {
    if (!raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>;

    if (!input.tool_name && !input.hook_event_name) return null;

    return {
      toolName: (input.tool_name as string) ?? "unknown",
      toolInput: (input.tool_input as Record<string, unknown>) ?? {},
      toolResponse: input.tool_response,
      sessionId: input.session_id as string | undefined,
      model: this.detectModel(input),
      agentType: this.id,
      cwd: input.cwd as string | undefined,
      durationMs: input.duration_ms as number | undefined,
      effort: parseEffort(input.effort),
    };
  }

  detectModel(input: unknown): string | undefined {
    const inp = (input ?? {}) as Record<string, unknown>;

    // 1. Check input field first
    if (typeof inp.model === "string" && inp.model.trim()) return inp.model.trim();

    // 2. Check environment variables
    const envCandidates = [
      "ANTHROPIC_MODEL",
      "CLAUDE_MODEL",
      "OPENAI_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    ];
    for (const key of envCandidates) {
      const val = process.env[key];
      if (val && val.trim()) return val.trim();
    }

    // 3. Read from Claude Code settings files
    const home = homedir();
    const settingsPaths = [
      join(home, ".claude", "settings.local.json"),
      join(home, ".claude", "settings.json"),
    ];

    for (const settingsPath of settingsPaths) {
      try {
        if (!existsSync(settingsPath)) continue;
        const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
        const fromEnv = settings?.env?.ANTHROPIC_MODEL;
        if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
        const fromModel = settings?.model;
        if (fromModel && typeof fromModel === "string" && fromModel.trim()) return fromModel.trim();
      } catch {
        // ignore
      }
    }

    return undefined;
  }
}

/** Extract effort string from input — Claude Code may send an object like {"level": "high"} */
function parseEffort(effort: unknown): string | undefined {
  if (typeof effort === "string" && effort.trim()) return effort.trim();
  if (effort && typeof effort === "object") {
    const obj = effort as Record<string, unknown>;
    if (typeof obj.level === "string") return obj.level;
  }
  return undefined;
}
