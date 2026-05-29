/**
 * Hook command — receives tool call data via stdin and records it.
 * Uses the adapter layer for model/agent detection.
 */

import { homedir } from "node:os";
import { join, basename } from "node:path";
import { MeterDB } from "../db/client.js";
import { parseTokenUsage, estimateFromArguments, estimateTokens } from "../token/counter.js";
import { estimateCost } from "../token/pricing.js";
import { getAdapter, getAllAdapters } from "../adapters/index.js";

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");

/**
 * Read all of stdin using the async stream API. This is reliable on all
 * platforms including macOS where npx may re-spawn the process and break
 * synchronous fd reads (readFileSync(0)).
 */
function readStdin(timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`stdin read timed out after ${timeoutMs}ms — no data received`));
      process.stdin.destroy();
    }, timeoutMs);

    process.stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    process.stdin.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Ensure the stream is in flowing mode so data events fire
    process.stdin.resume();
  });
}

export async function hookCommand(): Promise<void> {
  if (process.env.DEBUG_AGENTMETER) {
    console.error("[agentmeter] hook started, reading stdin...");
  }

  let raw: string;
  try {
    raw = await readStdin();
  } catch (err) {
    console.error("[agentmeter] Failed to read stdin:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (process.env.DEBUG_AGENTMETER) {
    console.error(`[agentmeter] stdin received: ${raw.length} chars`);
  }

  if (!raw.trim()) {
    console.error("[agentmeter] stdin was empty — no data to process");
    process.exit(0);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    console.error("[agentmeter] Failed to parse stdin JSON:", err instanceof Error ? err.message : err);
    if (process.env.DEBUG_AGENTMETER) {
      console.error("[agentmeter] Raw stdin (first 500 chars):", raw.slice(0, 500));
    }
    process.exit(1);
  }

  // Use adapter layer to parse input and detect model/agent
  const parsed = tryAdapters(input);

  let db: MeterDB;
  try {
    db = new MeterDB(DB_PATH);
  } catch (err) {
    console.error("[agentmeter] Failed to open database:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    const timestamp = new Date().toISOString();
    const toolName = parsed.toolName;
    const model = parsed.model;
    const agentType = parsed.agentType;
    const effort = parsed.effort;
    const project = parsed.cwd ? basename(parsed.cwd) : undefined;

    // Try to get token usage from response
    let tokenUsage = parsed.toolResponse ? parseTokenUsage(parsed.toolResponse) : null;

    // Estimate input tokens from arguments
    const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(parsed.toolInput ?? {});

    // Extract cache token data
    const cacheCreationTokens = tokenUsage?.cacheCreationInputTokens ?? 0;
    const cacheReadTokens = tokenUsage?.cacheReadInputTokens ?? 0;

    // Estimate output tokens from response
    let outputTokens = tokenUsage?.outputTokens ?? 0;
    if (outputTokens === 0 && parsed.toolResponse) {
      outputTokens = estimateResponseTokens(parsed.toolResponse);
    }

    // Estimate cost with detected model (cache-aware)
    const cost = estimateCost(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens);

    // Create argument summary (truncate sensitive data)
    const argsSummary = createArgsSummary(parsed.toolInput);

    db.insertCall({
      timestamp,
      session_id: parsed.sessionId,
      tool_name: toolName,
      model: model,
      agent_type: agentType,
      project: project,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
      estimated_cost: cost,
      duration_ms: parsed.durationMs,
      effort: effort,
      is_error: isError(parsed.toolResponse),
      arguments_summary: argsSummary,
    });

    if (process.env.DEBUG_AGENTMETER) {
      console.error(`[agentmeter] recorded: tool=${toolName} model=${model ?? "unknown"} agent=${agentType} tokens=${inputTokens}+${outputTokens}`);
    }
  } catch (err) {
    console.error("[agentmeter] Failed to record tool call:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    db.close();
  }

  process.exit(0);
}

/**
 * Try each adapter's parseInput until one succeeds.
 * Falls back to generic parsing if no adapter matches.
 */
function tryAdapters(input: unknown): {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResponse?: unknown;
  sessionId?: string;
  model?: string;
  agentType: string;
  cwd?: string;
  durationMs?: number;
  effort?: string;
} {
  // Try each adapter
  for (const adapter of getAllAdapters()) {
    try {
      const parsed = adapter.parseInput(input);
      if (parsed) {
        if (process.env.DEBUG_AGENTMETER) {
          console.error(`[agentmeter] matched adapter: ${adapter.id}`);
        }
        return parsed;
      }
    } catch {
      // try next adapter
    }
  }

  // Fallback: generic parsing from the raw JSON
  const inp = (input ?? {}) as Record<string, unknown>;
  return {
    toolName: (inp.tool_name as string) ?? "unknown",
    toolInput: (inp.tool_input as Record<string, unknown>) ?? {},
    toolResponse: inp.tool_response,
    sessionId: inp.session_id as string | undefined,
    model: detectModelFallback(inp),
    agentType: "unknown",
    cwd: inp.cwd as string | undefined,
    durationMs: inp.duration_ms as number | undefined,
    effort: parseEffort(inp.effort),
  };
}

/** Fallback model detection when no adapter matches */
function detectModelFallback(input: Record<string, unknown>): string | undefined {
  if (typeof input.model === "string" && input.model.trim()) return input.model.trim();

  const envKeys = [
    "ANTHROPIC_MODEL",
    "OPENAI_MODEL",
    "CLAUDE_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  ];
  for (const key of envKeys) {
    const val = process.env[key];
    if (val && val.trim()) return val.trim();
  }

  return undefined;
}

/** Extract effort string — Claude Code may send an object like {"level": "high"} */
function parseEffort(effort: unknown): string | undefined {
  if (typeof effort === "string" && effort.trim()) return effort.trim();
  if (effort && typeof effort === "object") {
    const obj = effort as Record<string, unknown>;
    if (typeof obj.level === "string") return obj.level;
  }
  return undefined;
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

function createArgsSummary(args: Record<string, unknown>): string {
  if (!args) return "";

  const summary: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
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
