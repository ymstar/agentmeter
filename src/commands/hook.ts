import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { MeterDB } from "../db/client.js";
import { parseTokenUsage, estimateFromArguments, estimateTokens } from "../token/counter.js";
import { estimateCost } from "../token/pricing.js";

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: unknown;
  session_id?: string;
  model?: string;
  agent_type?: string;
  cwd?: string;
  conversation_turn?: number;
  effort?: string;
  duration_ms?: number;
}

export function hookCommand(): void {
  let raw: string;
  try {
    raw = readFileSync("/dev/stdin", "utf-8");
  } catch {
    process.exit(0);
  }

  if (!raw.trim()) {
    process.exit(0);
  }

  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.exit(0);
  }

  // Note: Claude Code sends cwd, duration_ms, hook_event_name, permission_mode, effort, transcript_path
  // but does NOT send model or agent_type - these are detected from env vars, settings, and patterns

  const db = new MeterDB(DB_PATH);

  try {
    const timestamp = new Date().toISOString();
    const toolName = input.tool_name ?? "unknown";

    // Detect model from environment or input
    const model = detectModel(input);

    // Detect agent type (Claude Code, Cursor, etc.)
    const agentType = detectAgentType(input);

    // Detect effort level (high/medium/low - may correspond to different models)
    const effort = input.effort ?? process.env.CLAUDE_EFFORT ?? undefined;

    // Extract project name from cwd
    const project = input.cwd ? basename(input.cwd) : undefined;

    // Try to get token usage from response
    let tokenUsage = input.tool_response ? parseTokenUsage(input.tool_response) : null;

    // Estimate input tokens from arguments
    const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(input.tool_input ?? {});

    // Extract cache token data
    const cacheCreationTokens = tokenUsage?.cacheCreationInputTokens ?? 0;
    const cacheReadTokens = tokenUsage?.cacheReadInputTokens ?? 0;

    // Estimate output tokens from response
    let outputTokens = tokenUsage?.outputTokens ?? 0;
    if (outputTokens === 0 && input.tool_response) {
      outputTokens = estimateResponseTokens(input.tool_response);
    }

    // Estimate cost with detected model (cache-aware)
    const cost = estimateCost(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens);

    // Create argument summary (truncate sensitive data)
    const argsSummary = createArgsSummary(input.tool_input);

    db.insertCall({
      timestamp,
      session_id: input.session_id,
      tool_name: toolName,
      model: model,
      agent_type: agentType,
      project: project,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
      estimated_cost: cost,
      duration_ms: input.duration_ms,
      effort: effort,
      is_error: isError(input.tool_response),
      arguments_summary: argsSummary,
    });
  } finally {
    db.close();
  }

  process.exit(0);
}

function estimateResponseTokens(response: unknown): number {
  if (!response) return 0;

  // If response is a string, estimate directly
  if (typeof response === "string") {
    return estimateTokens(response);
  }

  // If response is an object, try various fields
  if (typeof response === "object") {
    const r = response as Record<string, unknown>;

    // MCP format: { content: [{ type: "text", text: "..." }] }
    if (Array.isArray(r.content)) {
      let total = 0;
      for (const item of r.content) {
        if (item && typeof item === "object") {
          const c = item as Record<string, unknown>;
          if (typeof c.text === "string") {
            total += estimateTokens(c.text);
          }
        }
      }
      if (total > 0) return total;
    }

    // Try common output fields
    for (const key of ["output", "result", "text", "message", "data", "stdout"]) {
      if (typeof r[key] === "string") {
        return estimateTokens(r[key] as string);
      }
    }

    // Estimate from the entire response object
    const str = JSON.stringify(response);
    if (str.length > 10) {
      return estimateTokens(str);
    }
  }

  return 0;
}

function isError(response: unknown): boolean {
  if (!response) return false;
  if (typeof response === "object") {
    const r = response as Record<string, unknown>;
    return r.isError === true || r.error !== undefined;
  }
  return false;
}

function detectModel(input: HookInput): string | undefined {
  // Check input field first
  if (input.model) return input.model;

  // Check environment variables
  const envModel = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? process.env.OPENAI_MODEL;
  if (envModel) return envModel;

  // Try reading from Claude Code settings
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      // Check env section first, then top-level model
      const model = settings?.env?.ANTHROPIC_MODEL ?? settings?.model;
      if (model && typeof model === "string") return model;
    }
  } catch {
    // Settings read failed — fall through to default
    if (process.env.DEBUG_AGENTMETER) {
      console.error("[agentmeter] Warning: failed to read ~/.claude/settings.json for model detection");
    }
  }

  // Default based on common patterns
  return "claude-sonnet-4-20250514";
}

function detectAgentType(input: HookInput): string {
  // Check input field
  if (input.agent_type) return input.agent_type;

  // Detect from environment (Claude Code sets CLAUDECODE=1, not CLAUDE_CODE)
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return "claude-code";
  if (process.env.CURSOR) return "cursor";
  if (process.env.GEMINI_CLI) return "gemini-cli";

  // Check for Claude Code session ID from env
  if (process.env.CLAUDE_CODE_SESSION_ID) return "claude-code";

  // Detect from process invocation — if this hook was spawned by Claude Code's
  // PostToolUse hook, the command will contain "agentmeter" and "hook".
  // This catches cases where env vars (CLAUDECODE, etc.) are not inherited
  // by the hook subprocess.
  const argv = process.argv.join(" ").toLowerCase();
  if (argv.includes("agentmeter") && argv.includes("hook")) return "claude-code";

  // Check session_id format (Claude Code uses UUIDs)
  if (input.session_id && typeof input.session_id === "string") {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.session_id)) {
      return "claude-code";
    }
    if (/^session_/i.test(input.session_id) || /^[0-9a-f]{16,}$/i.test(input.session_id)) {
      return "claude-code";
    }
  }

  // Check if cwd is provided (Claude Code sends this)
  if (input.cwd) return "claude-code";

  // Check if Claude Code is installed (strong signal — moved up from bottom)
  if (existsSync(join(homedir(), ".claude"))) return "claude-code";

  // Check model - if it's a Claude model, it's likely Claude Code
  if (input.model && /claude/i.test(input.model)) return "claude-code";

  return "unknown";
}

function createArgsSummary(args: Record<string, unknown>): string {
  if (!args) return "";

  const summary: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      // Truncate long strings, mask potential secrets
      if (value.length > 100) {
        summary[key] = value.slice(0, 100) + "...";
      } else if (/key|token|secret|password/i.test(key)) {
        summary[key] = "***";
      } else {
        summary[key] = value;
      }
    } else {
      summary[key] = String(value);
    }
  }

  const str = JSON.stringify(summary);
  return str.length > 500 ? str.slice(0, 500) + "..." : str;
}
