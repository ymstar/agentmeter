     1|import { readFileSync, existsSync } from "node:fs";
     2|import { homedir } from "node:os";
     3|import { join, basename } from "node:path";
     4|import { MeterDB } from "../db/client.js";
     5|import { parseTokenUsage, estimateFromArguments, estimateTokens } from "../token/counter.js";
     6|import { estimateCost } from "../token/pricing.js";
     7|const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
     8|export function hookCommand() {
     9|    let raw;
    10|    try {
    11|        raw = readFileSync("/dev/stdin", "utf-8");
    12|    }
    13|    catch {
    14|        process.exit(0);
    15|    }
    16|    if (!raw.trim()) {
    17|        process.exit(0);
    18|    }
    19|    let input;
    20|    try {
    21|        input = JSON.parse(raw);
    22|    }
    23|    catch {
    24|        process.exit(0);
    25|    }
    26|    // Note: Claude Code sends cwd, duration_ms, hook_event_name, permission_mode, effort, transcript_path
    27|    // but does NOT send model or agent_type - these are detected from env vars, settings, and patterns
    28|    const db = new MeterDB(DB_PATH);
    29|    try {
    30|        const timestamp = new Date().toISOString();
    31|        const toolName = input.tool_name ?? "unknown";
    32|        // Detect model from environment or input
    33|        const model = detectModel(input);
    34|        // Detect agent type (Claude Code, Cursor, etc.)
    35|        const agentType = detectAgentType(input);
    36|        // Detect effort level (high/medium/low - may correspond to different models)
    37|        const effort = input.effort ?? process.env.CLAUDE_EFFORT ?? undefined;
    38|        // Extract project name from cwd
    39|        const project = input.cwd ? basename(input.cwd) : undefined;
    40|        // Try to get token usage from response
    41|        let tokenUsage = input.tool_response ? parseTokenUsage(input.tool_response) : null;
    42|        // Estimate input tokens from arguments
    43|        const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(input.tool_input ?? {});
    44|        // Extract cache token data
    45|        const cacheCreationTokens = tokenUsage?.cacheCreationInputTokens ?? 0;
    46|        const cacheReadTokens = tokenUsage?.cacheReadInputTokens ?? 0;
    47|        // Estimate output tokens from response
    48|        let outputTokens = tokenUsage?.outputTokens ?? 0;
    49|        if (outputTokens === 0 && input.tool_response) {
    50|            outputTokens = estimateResponseTokens(input.tool_response);
    51|        }
    52|        // Estimate cost with detected model (cache-aware)
    53|        const cost = estimateCost(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens);
    54|        // Create argument summary (truncate sensitive data)
    55|        const argsSummary = createArgsSummary(input.tool_input);
    56|        db.insertCall({
    57|            timestamp,
    58|            session_id: input.session_id,
    59|            tool_name: toolName,
    60|            model: model,
    61|            agent_type: agentType,
    62|            project: project,
    63|            input_tokens: inputTokens,
    64|            output_tokens: outputTokens,
    65|            cache_creation_input_tokens: cacheCreationTokens,
    66|            cache_read_input_tokens: cacheReadTokens,
    67|            estimated_cost: cost,
    68|            duration_ms: input.duration_ms,
    69|            effort: effort,
    70|            is_error: isError(input.tool_response),
    71|            arguments_summary: argsSummary,
    72|        });
    73|    }
    74|    finally {
    75|        db.close();
    76|    }
    77|    process.exit(0);
    78|}
    79|function estimateResponseTokens(response) {
    80|    if (!response)
    81|        return 0;
    82|    // If response is a string, estimate directly
    83|    if (typeof response === "string") {
    84|        return estimateTokens(response);
    85|    }
    86|    // If response is an object, try various fields
    87|    if (typeof response === "object") {
    88|        const r = response;
    89|        // MCP format: { content: [{ type: "text", text: "..." }] }
    90|        if (Array.isArray(r.content)) {
    91|            let total = 0;
    92|            for (const item of r.content) {
    93|                if (item && typeof item === "object") {
    94|                    const c = item;
    95|                    if (typeof c.text === "string") {
    96|                        total += estimateTokens(c.text);
    97|                    }
    98|                }
    99|            }
   100|            if (total > 0)
   101|                return total;
   102|        }
   103|        // Try common output fields
   104|        for (const key of ["output", "result", "text", "message", "data", "stdout"]) {
   105|            if (typeof r[key] === "string") {
   106|                return estimateTokens(r[key]);
   107|            }
   108|        }
   109|        // Estimate from the entire response object
   110|        const str = JSON.stringify(response);
   111|        if (str.length > 10) {
   112|            return estimateTokens(str);
   113|        }
   114|    }
   115|    return 0;
   116|}
   117|function isError(response) {
   118|    if (!response)
   119|        return false;
   120|    if (typeof response === "object") {
   121|        const r = response;
   122|        return r.isError === true || r.error !== undefined;
   123|    }
   124|    return false;
   125|}
   126|function detectModel(input) {
   127|    // Check input field first
   128|    if (input.model && input.model.trim())
   129|        return input.model.trim();
   130|    // Check environment variables
   131|    const envModel = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? process.env.OPENAI_MODEL;
   132|    if (envModel && envModel.trim())
   133|        return envModel.trim();
   134|    // Try reading from Claude Code settings
   135|    try {
   136|        const settingsPath = join(homedir(), ".claude", "settings.json");
   137|        if (existsSync(settingsPath)) {
   138|            const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
   139|            // Check env section first, then top-level model
   140|            const model = settings?.env?.ANTHROPIC_MODEL ?? settings?.model;
   141|            if (model && typeof model === "string" && model.trim())
   142|                return model.trim();
   143|        }
   144|    }
   145|    catch {
   146|        // Settings read failed — fall through to default
   147|        if (process.env.DEBUG_AGENTMETER) {
   148|            console.error("[agentmeter] Warning: failed to read ~/.claude/settings.json for model detection");
   149|        }
   150|    }
   151|    // Default based on common patterns
   152|    return "claude-sonnet-4-20250514";
   153|}
   154|function detectAgentType(input) {
   155|    // Check input field
   156|    if (input.agent_type)
   157|        return input.agent_type;
   158|    // Detect from environment (Claude Code sets CLAUDECODE=1, not CLAUDE_CODE)
   159|    if (process.env.CLAUDECODE || process.env.CLAUDE_CODE)
   160|        return "claude-code";
   161|    if (process.env.CURSOR)
   162|        return "cursor";
   163|    if (process.env.GEMINI_CLI)
   164|        return "gemini-cli";
   165|    // Check for Claude Code session ID from env
   166|    if (process.env.CLAUDE_CODE_SESSION_ID)
   167|        return "claude-code";
   168|    // Detect from process invocation — if this hook was spawned by Claude Code's
   169|    // PostToolUse hook, the command will contain "agentmeter" and "hook".
   170|    // This catches cases where env vars (CLAUDECODE, etc.) are not inherited
   171|    // by the hook subprocess.
   172|    const argv = process.argv.join(" ").toLowerCase();
   173|    if (argv.includes("agentmeter") && argv.includes("hook"))
   174|        return "claude-code";
   175|    // Check session_id format (Claude Code uses UUIDs)
   176|    if (input.session_id && typeof input.session_id === "string") {
   177|        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.session_id)) {
   178|            return "claude-code";
   179|        }
   180|        if (/^session_/i.test(input.session_id) || /^[0-9a-f]{16,}$/i.test(input.session_id)) {
   181|            return "claude-code";
   182|        }
   183|    }
   184|    // Check if cwd is provided (Claude Code sends this)
   185|    if (input.cwd)
   186|        return "claude-code";
   187|    // Check if Claude Code is installed (strong signal — moved up from bottom)
   188|    if (existsSync(join(homedir(), ".claude")))
   189|        return "claude-code";
   190|    // Check model - if it's a Claude model, it's likely Claude Code
   191|    if (input.model && /claude/i.test(input.model))
   192|        return "claude-code";
   193|    return "unknown";
   194|}
   195|function createArgsSummary(args) {
   196|    if (!args)
   197|        return "";
   198|    const summary = {};
   199|    for (const [key, value] of Object.entries(args)) {
   200|        if (typeof value === "string") {
   201|            // Truncate long strings, mask potential secrets
   202|            if (value.length > 100) {
   203|                summary[key] = value.slice(0, 100) + "...";
   204|            }
   205|            else if (/key|token|secret|password/i.test(key)) {
   206|                summary[key] = "***";
   207|            }
   208|            else {
   209|                summary[key] = value;
   210|            }
   211|        }
   212|        else {
   213|            summary[key] = String(value);
   214|        }
   215|    }
   216|    const str = JSON.stringify(summary);
   217|    return str.length > 500 ? str.slice(0, 500) + "..." : str;
   218|}
   219|//# sourceMappingURL=hook.js.map