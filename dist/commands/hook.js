import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { MeterDB } from "../db/client.js";
import { parseTokenUsage, estimateFromArguments, estimateTokens } from "../token/counter.js";
import { estimateCost } from "../token/pricing.js";
const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
/**
 * Read all of stdin using the async stream API. This is reliable on all
 * platforms including macOS where npx may re-spawn the process and break
 * synchronous fd reads (readFileSync(0)).
 */
function readStdin(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const timer = setTimeout(() => {
            reject(new Error(`stdin read timed out after ${timeoutMs}ms — no data received`));
            process.stdin.destroy();
        }, timeoutMs);
        process.stdin.on("data", (chunk) => {
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
export async function hookCommand() {
    if (process.env.DEBUG_AGENTMETER) {
        console.error("[agentmeter] hook started, reading stdin...");
    }
    let raw;
    try {
        raw = await readStdin();
    }
    catch (err) {
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
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch (err) {
        console.error("[agentmeter] Failed to parse stdin JSON:", err instanceof Error ? err.message : err);
        if (process.env.DEBUG_AGENTMETER) {
            console.error("[agentmeter] Raw stdin (first 500 chars):", raw.slice(0, 500));
        }
        process.exit(1);
    }
    // Note: Claude Code sends cwd, duration_ms, hook_event_name, permission_mode, effort, transcript_path
    // but does NOT send model or agent_type - these are detected from env vars, settings, and patterns
    let db;
    try {
        db = new MeterDB(DB_PATH);
    }
    catch (err) {
        console.error("[agentmeter] Failed to open database:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
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
        if (process.env.DEBUG_AGENTMETER) {
            console.error(`[agentmeter] recorded: tool=${toolName} model=${model ?? "unknown"} agent=${agentType} tokens=${inputTokens}+${outputTokens}`);
        }
    }
    catch (err) {
        console.error("[agentmeter] Failed to record tool call:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
    finally {
        db.close();
    }
    process.exit(0);
}
function estimateResponseTokens(response) {
    if (!response)
        return 0;
    // If response is a string, estimate directly
    if (typeof response === "string") {
        return estimateTokens(response);
    }
    // If response is an object, try various fields
    if (typeof response === "object") {
        const r = response;
        // MCP format: { content: [{ type: "text", text: "..." }] }
        if (Array.isArray(r.content)) {
            let total = 0;
            for (const item of r.content) {
                if (item && typeof item === "object") {
                    const c = item;
                    if (typeof c.text === "string") {
                        total += estimateTokens(c.text);
                    }
                }
            }
            if (total > 0)
                return total;
        }
        // Try common output fields
        for (const key of ["output", "result", "text", "message", "data", "stdout"]) {
            if (typeof r[key] === "string") {
                return estimateTokens(r[key]);
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
function isError(response) {
    if (!response)
        return false;
    if (typeof response === "object") {
        const r = response;
        return r.isError === true || r.error !== undefined;
    }
    return false;
}
function detectModel(input) {
    // 1. Check input field first (some agents pass model in stdin JSON)
    if (input.model && input.model.trim())
        return input.model.trim();
    // 2. Check environment variables
    //    Claude Code injects settings.json "env" vars into its process,
    //    which child processes (hooks) should inherit.
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
        if (val && val.trim())
            return val.trim();
    }
    // 3. Read from Claude Code settings files directly
    //    This is the fallback when env vars are not inherited by the hook subprocess.
    //    Read settings.local.json first (user-specific, may override settings.json).
    const home = homedir();
    const settingsPaths = [
        join(home, ".claude", "settings.local.json"),
        join(home, ".claude", "settings.json"),
    ];
    for (const settingsPath of settingsPaths) {
        try {
            if (!existsSync(settingsPath))
                continue;
            const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
            // env.ANTHROPIC_MODEL is most reliable for non-Anthropic models (mimo, etc.)
            const fromEnv = settings?.env?.ANTHROPIC_MODEL;
            if (fromEnv && typeof fromEnv === "string" && fromEnv.trim())
                return fromEnv.trim();
            // Top-level "model" field
            const fromModel = settings?.model;
            if (fromModel && typeof fromModel === "string" && fromModel.trim())
                return fromModel.trim();
        }
        catch {
            if (process.env.DEBUG_AGENTMETER) {
                console.error(`[agentmeter] Warning: failed to read ${settingsPath}`);
            }
        }
    }
    // Could not detect — return undefined (will show as "unknown" in dashboard)
    return undefined;
}
function detectAgentType(input) {
    // Check input field
    if (input.agent_type)
        return input.agent_type;
    // Detect from environment (Claude Code sets CLAUDECODE=1, not CLAUDE_CODE)
    if (process.env.CLAUDECODE || process.env.CLAUDE_CODE)
        return "claude-code";
    if (process.env.CURSOR)
        return "cursor";
    if (process.env.GEMINI_CLI)
        return "gemini-cli";
    // Check for Claude Code session ID from env
    if (process.env.CLAUDE_CODE_SESSION_ID)
        return "claude-code";
    // Detect from process invocation — if this hook was spawned by Claude Code's
    // PostToolUse hook, the command will contain "agentmeter" and "hook".
    // This catches cases where env vars (CLAUDECODE, etc.) are not inherited
    // by the hook subprocess.
    const argv = process.argv.join(" ").toLowerCase();
    if (argv.includes("agentmeter") && argv.includes("hook"))
        return "claude-code";
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
    if (input.cwd)
        return "claude-code";
    // Check if Claude Code is installed (strong signal — moved up from bottom)
    if (existsSync(join(homedir(), ".claude")))
        return "claude-code";
    // Check model - if it's a Claude model, it's likely Claude Code
    if (input.model && /claude/i.test(input.model))
        return "claude-code";
    return "unknown";
}
function createArgsSummary(args) {
    if (!args)
        return "";
    const summary = {};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") {
            // Truncate long strings, mask potential secrets
            if (value.length > 100) {
                summary[key] = value.slice(0, 100) + "...";
            }
            else if (/key|token|secret|password/i.test(key)) {
                summary[key] = "***";
            }
            else {
                summary[key] = value;
            }
        }
        else {
            summary[key] = String(value);
        }
    }
    const str = JSON.stringify(summary);
    return str.length > 500 ? str.slice(0, 500) + "..." : str;
}
//# sourceMappingURL=hook.js.map