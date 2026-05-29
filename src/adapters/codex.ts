/**
 * OpenAI Codex CLI adapter.
 *
 * Codex doesn't have a PostToolUse hook system like Claude Code.
 * Integration approach: wrapper script that captures codex session output.
 *
 * For now, this adapter supports:
 * - Detection of Codex CLI installation
 * - Model detection from environment/config
 * - Future: MCP server integration for real-time tracking
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, InitResult, ParsedToolCall } from "./types.js";

export class CodexAdapter implements AgentAdapter {
  id = "codex";
  displayName = "OpenAI Codex CLI";

  detect(): boolean {
    // Check for codex config directory or auth file
    const home = homedir();
    if (existsSync(join(home, ".codex"))) return true;
    // Check if codex binary is available
    try {
      const { execSync } = require("node:child_process");
      execSync("which codex", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  init(): InitResult {
    const home = homedir();
    const codexDir = join(home, ".codex");

    if (!existsSync(codexDir)) {
      return {
        success: false,
        message: "Codex CLI not detected. Install it first:",
        instructions: [
          "npm install -g @openai/codex",
          "Then run: agentmeter init codex",
        ],
      };
    }

    // Codex doesn't have native hooks. Provide instructions for manual integration.
    // Future: register an MCP server via `codex mcp add`
    return {
      success: true,
      message: "Codex CLI detected. AgentMeter will track Codex usage via wrapper.",
      instructions: [
        "",
        "Codex doesn't support PostToolUse hooks like Claude Code.",
        "To track Codex usage, use the wrapper command:",
        "",
        "  npx -y @ymstar/agentmeter codex-wrap codex exec 'your prompt'",
        "",
        "Or set up an alias in your shell profile (~/.zshrc or ~/.bashrc):",
        "",
        "  alias codex-tracked='npx -y @ymstar/agentmeter codex-wrap codex'",
        "",
        "Then use `codex-tracked exec 'your prompt'` instead of `codex exec`.",
      ],
    };
  }

  uninstall(): void {
    // Nothing to clean up — wrapper is invoked manually
  }

  parseInput(raw: unknown): ParsedToolCall | null {
    // Codex doesn't send structured tool call data via stdin.
    // This will be used when we implement MCP server or transcript parsing.
    if (!raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>;

    return {
      toolName: (input.tool as string) ?? (input.tool_name as string) ?? "unknown",
      toolInput: (input.input ?? input.tool_input ?? {}) as Record<string, unknown>,
      toolResponse: input.output ?? input.tool_response,
      sessionId: input.session_id as string | undefined,
      model: this.detectModel(input),
      agentType: this.id,
      cwd: input.cwd as string | undefined,
    };
  }

  detectModel(input: unknown): string | undefined {
    const inp = (input ?? {}) as Record<string, unknown>;

    // 1. Check input field
    if (typeof inp.model === "string" && inp.model.trim()) return inp.model.trim();

    // 2. Check environment variables
    const envCandidates = ["OPENAI_MODEL", "OPENAI_API_MODEL"];
    for (const key of envCandidates) {
      const val = process.env[key];
      if (val && val.trim()) return val.trim();
    }

    // 3. Read Codex config
    const home = homedir();
    const configPaths = [
      join(home, ".codex", "config.json"),
      join(home, ".codex", "config.yaml"),
    ];

    for (const configPath of configPaths) {
      try {
        if (!existsSync(configPath)) continue;
        const content = readFileSync(configPath, "utf-8");
        if (configPath.endsWith(".json")) {
          const config = JSON.parse(content);
          if (config.model && typeof config.model === "string") return config.model;
        }
      } catch {
        // ignore
      }
    }

    return undefined;
  }
}
