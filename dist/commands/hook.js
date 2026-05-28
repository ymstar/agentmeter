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
   127|    // 1. Check input field first (some agents pass model in stdin JSON)
   128|    if (input.model && input.model.trim())
   129|        return input.model.trim();
   130|    // 2. Check environment variables
   131|    //    Claude Code injects settings.json "env" vars into its process,
   132|    //    which child processes (hooks) should inherit.
   133|    const envCandidates = [
   134|        "ANTHROPIC_MODEL",
   135|        "CLAUDE_MODEL",
   136|        "OPENAI_MODEL",
   137|        "ANTHROPIC_DEFAULT_SONNET_MODEL",
   138|        "ANTHROPIC_DEFAULT_OPUS_MODEL",
   139|        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
   140|    ];
   141|    for (const key of envCandidates) {
   142|        const val = process.env[key];
   143|        if (val && val.trim())
   144|            return val.trim();
   145|    }
   146|    // 3. Read from Claude Code settings files directly
   147|    //    This is the fallback when env vars are not inherited by the hook subprocess.
   148|    //    Read settings.local.json first (user-specific, may override settings.json).
   149|    const home = homedir();
   150|    const settingsPaths = [
   151|        join(home, ".claude", "settings.local.json"),
   152|        join(home, ".claude", "settings.json"),
   153|    ];
   154|    for (const settingsPath of settingsPaths) {
   155|        try {
   156|            if (!existsSync(settingsPath))
   157|                continue;
   158|            const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
   159|            // env.ANTHROPIC_MODEL is most reliable for non-Anthropic models (mimo, etc.)
   160|            const fromEnv = settings?.env?.ANTHROPIC_MODEL;
   161|            if (fromEnv && typeof fromEnv === "string" && fromEnv.trim())
   162|                return fromEnv.trim();
   163|            // Top-level "model" field
   164|            const fromModel = settings?.model;
   165|            if (fromModel && typeof fromModel === "string" && fromModel.trim())
   166|                return fromModel.trim();
   167|        }
   168|        catch {
   169|            if (process.env.DEBUG_AGENTMETER) {
   170|                console.error(`[agentmeter] Warning: failed to read ${settingsPath}`);
   171|            }
   172|        }
   173|    }
   174|    // Could not detect — return undefined (will show as "unknown" in dashboard)
   175|    return undefined;
   176|}
   177|function detectAgentType(input) {
   178|    // Check input field
   179|    if (input.agent_type)
   180|        return input.agent_type;
   181|    // Detect from environment (Claude Code sets CLAUDECODE=1, not CLAUDE_CODE)
   182|    if (process.env.CLAUDECODE || process.env.CLAUDE_CODE)
   183|        return "claude-code";
   184|    if (process.env.CURSOR)
   185|        return "cursor";
   186|    if (process.env.GEMINI_CLI)
   187|        return "gemini-cli";
   188|    // Check for Claude Code session ID from env
   189|    if (process.env.CLAUDE_CODE_SESSION_ID)
   190|        return "claude-code";
   191|    // Detect from process invocation — if this hook was spawned by Claude Code's
   192|    // PostToolUse hook, the command will contain "agentmeter" and "hook".
   193|    // This catches cases where env vars (CLAUDECODE, etc.) are not inherited
   194|    // by the hook subprocess.
   195|    const argv = process.argv.join(" ").toLowerCase();
   196|    if (argv.includes("agentmeter") && argv.includes("hook"))
   197|        return "claude-code";
   198|    // Check session_id format (Claude Code uses UUIDs)
   199|    if (input.session_id && typeof input.session_id === "string") {
   200|        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.session_id)) {
   201|            return "claude-code";
   202|        }
   203|        if (/^session_/i.test(input.session_id) || /^[0-9a-f]{16,}$/i.test(input.session_id)) {
   204|            return "claude-code";
   205|        }
   206|    }
   207|    // Check if cwd is provided (Claude Code sends this)
   208|    if (input.cwd)
   209|        return "claude-code";
   210|    // Check if Claude Code is installed (strong signal — moved up from bottom)
   211|    if (existsSync(join(homedir(), ".claude")))
   212|        return "claude-code";
   213|    // Check model - if it's a Claude model, it's likely Claude Code
   214|    if (input.model && /claude/i.test(input.model))
   215|        return "claude-code";
   216|    return "unknown";
   217|}
   218|function createArgsSummary(args) {
   219|    if (!args)
   220|        return "";
   221|    const summary = {};
   222|    for (const [key, value] of Object.entries(args)) {
   223|        if (typeof value === "string") {
   224|            // Truncate long strings, mask potential secrets
   225|            if (value.length > 100) {
   226|                summary[key] = value.slice(0, 100) + "...";
   227|            }
   228|            else if (/key|token|secret|password/i.test(key)) {
   229|                summary[key] = "***";
   230|            }
   231|            else {
   232|                summary[key] = value;
   233|            }
   234|        }
   235|        else {
   236|            summary[key] = String(value);
   237|        }
   238|    }
   239|    const str = JSON.stringify(summary);
   240|    return str.length > 500 ? str.slice(0, 500) + "..." : str;
   241|}
   242|//# sourceMappingURL=hook.js.map