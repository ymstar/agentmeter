import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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

  const db = new MeterDB(DB_PATH);

  try {
    const timestamp = new Date().toISOString();
    const toolName = input.tool_name ?? "unknown";

    // Detect model from environment or input
    const model = detectModel(input);

    // Detect agent type (Claude Code, Cursor, etc.)
    const agentType = detectAgentType(input);

    // Try to get token usage from response
    let tokenUsage = input.tool_response ? parseTokenUsage(input.tool_response) : null;

    // Estimate input tokens from arguments
    const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(input.tool_input ?? {});

    // Estimate output tokens from response
    let outputTokens = tokenUsage?.outputTokens ?? 0;
    if (outputTokens === 0 && input.tool_response) {
      outputTokens = estimateResponseTokens(input.tool_response);
    }

    // Estimate cost with detected model
    const cost = estimateCost(inputTokens, outputTokens, model);

    // Create argument summary (truncate sensitive data)
    const argsSummary = createArgsSummary(input.tool_input);

    db.insertCall({
      timestamp,
      session_id: input.session_id,
      tool_name: toolName,
      model: model,
      agent_type: agentType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: cost,
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

  // Default based on common patterns
  return "claude-sonnet-4-20250514";
}

function detectAgentType(input: HookInput): string {
  // Check input field
  if (input.agent_type) return input.agent_type;

  // Detect from environment
  if (process.env.CLAUDE_CODE) return "claude-code";
  if (process.env.CURSOR) return "cursor";
  if (process.env.GEMINI_CLI) return "gemini-cli";

  // Check for Claude Code specific patterns
  if (input.session_id && typeof input.session_id === "string") {
    // Claude Code session IDs are UUIDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.session_id)) {
      return "claude-code";
    }
  }

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
