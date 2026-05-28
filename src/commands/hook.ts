     1|import { readFileSync, existsSync } from "node:fs";
     2|import { homedir } from "node:os";
     3|import { join, basename } from "node:path";
     4|import { MeterDB } from "../db/client.js";
     5|import { parseTokenUsage, estimateFromArguments, estimateTokens } from "../token/counter.js";
     6|import { estimateCost } from "../token/pricing.js";
     7|
     8|const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
     9|
    10|interface HookInput {
    11|  tool_name: string;
    12|  tool_input: Record<string, unknown>;
    13|  tool_response?: unknown;
    14|  session_id?: string;
    15|  model?: string;
    16|  agent_type?: string;
    17|  cwd?: string;
    18|  conversation_turn?: number;
    19|  effort?: string;
    20|  duration_ms?: number;
    21|}
    22|
    23|export function hookCommand(): void {
    24|  let raw: string;
    25|  try {
    26|    raw = readFileSync("/dev/stdin", "utf-8");
    27|  } catch {
    28|    process.exit(0);
    29|  }
    30|
    31|  if (!raw.trim()) {
    32|    process.exit(0);
    33|  }
    34|
    35|  let input: HookInput;
    36|  try {
    37|    input = JSON.parse(raw) as HookInput;
    38|  } catch {
    39|    process.exit(0);
    40|  }
    41|
    42|  // Note: Claude Code sends cwd, duration_ms, hook_event_name, permission_mode, effort, transcript_path
    43|  // but does NOT send model or agent_type - these are detected from env vars, settings, and patterns
    44|
    45|  const db = new MeterDB(DB_PATH);
    46|
    47|  try {
    48|    const timestamp = new Date().toISOString();
    49|    const toolName = input.tool_name ?? "unknown";
    50|
    51|    // Detect model from environment or input
    52|    const model = detectModel(input);
    53|
    54|    // Detect agent type (Claude Code, Cursor, etc.)
    55|    const agentType = detectAgentType(input);
    56|
    57|    // Detect effort level (high/medium/low - may correspond to different models)
    58|    const effort = input.effort ?? process.env.CLAUDE_EFFORT ?? undefined;
    59|
    60|    // Extract project name from cwd
    61|    const project = input.cwd ? basename(input.cwd) : undefined;
    62|
    63|    // Try to get token usage from response
    64|    let tokenUsage = input.tool_response ? parseTokenUsage(input.tool_response) : null;
    65|
    66|    // Estimate input tokens from arguments
    67|    const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(input.tool_input ?? {});
    68|
    69|    // Extract cache token data
    70|    const cacheCreationTokens = tokenUsage?.cacheCreationInputTokens ?? 0;
    71|    const cacheReadTokens = tokenUsage?.cacheReadInputTokens ?? 0;
    72|
    73|    // Estimate output tokens from response
    74|    let outputTokens = tokenUsage?.outputTokens ?? 0;
    75|    if (outputTokens === 0 && input.tool_response) {
    76|      outputTokens = estimateResponseTokens(input.tool_response);
    77|    }
    78|
    79|    // Estimate cost with detected model (cache-aware)
    80|    const cost = estimateCost(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens);
    81|
    82|    // Create argument summary (truncate sensitive data)
    83|    const argsSummary = createArgsSummary(input.tool_input);
    84|
    85|    db.insertCall({
    86|      timestamp,
    87|      session_id: input.session_id,
    88|      tool_name: toolName,
    89|      model: model,
    90|      agent_type: agentType,
    91|      project: project,
    92|      input_tokens: inputTokens,
    93|      output_tokens: outputTokens,
    94|      cache_creation_input_tokens: cacheCreationTokens,
    95|      cache_read_input_tokens: cacheReadTokens,
    96|      estimated_cost: cost,
    97|      duration_ms: input.duration_ms,
    98|      effort: effort,
    99|      is_error: isError(input.tool_response),
   100|      arguments_summary: argsSummary,
   101|    });
   102|  } finally {
   103|    db.close();
   104|  }
   105|
   106|  process.exit(0);
   107|}
   108|
   109|function estimateResponseTokens(response: unknown): number {
   110|  if (!response) return 0;
   111|
   112|  // If response is a string, estimate directly
   113|  if (typeof response === "string") {
   114|    return estimateTokens(response);
   115|  }
   116|
   117|  // If response is an object, try various fields
   118|  if (typeof response === "object") {
   119|    const r = response as Record<string, unknown>;
   120|
   121|    // MCP format: { content: [{ type: "text", text: "..." }] }
   122|    if (Array.isArray(r.content)) {
   123|      let total = 0;
   124|      for (const item of r.content) {
   125|        if (item && typeof item === "object") {
   126|          const c = item as Record<string, unknown>;
   127|          if (typeof c.text === "string") {
   128|            total += estimateTokens(c.text);
   129|          }
   130|        }
   131|      }
   132|      if (total > 0) return total;
   133|    }
   134|
   135|    // Try common output fields
   136|    for (const key of ["output", "result", "text", "message", "data", "stdout"]) {
   137|      if (typeof r[key] === "string") {
   138|        return estimateTokens(r[key] as string);
   139|      }
   140|    }
   141|
   142|    // Estimate from the entire response object
   143|    const str = JSON.stringify(response);
   144|    if (str.length > 10) {
   145|      return estimateTokens(str);
   146|    }
   147|  }
   148|
   149|  return 0;
   150|}
   151|
   152|function isError(response: unknown): boolean {
   153|  if (!response) return false;
   154|  if (typeof response === "object") {
   155|    const r = response as Record<string, unknown>;
   156|    return r.isError === true || r.error !== undefined;
   157|  }
   158|  return false;
   159|}
   160|
   161|function detectModel(input: HookInput): string {
   162|  // Check input field first
   163|  if (input.model && input.model.trim()) return input.model.trim();
   164|
   165|  // Check environment variables
   166|  const envModel = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? process.env.OPENAI_MODEL;
   167|  if (envModel && envModel.trim()) return envModel.trim();
   168|
   169|  // Try reading from Claude Code settings
   170|  try {
   171|    const settingsPath = join(homedir(), ".claude", "settings.json");
   172|    if (existsSync(settingsPath)) {
   173|      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
   174|      // Check env section first, then top-level model
   175|      const model = settings?.env?.ANTHROPIC_MODEL ?? settings?.model;
   176|      if (model && typeof model === "string" && model.trim()) return model.trim();
   177|    }
   178|  } catch {
   179|    // Settings read failed — fall through to default
   180|    if (process.env.DEBUG_AGENTMETER) {
   181|      console.error("[agentmeter] Warning: failed to read ~/.claude/settings.json for model detection");
   182|    }
   183|  }
   184|
   185|  // Default based on common patterns
   186|  return "claude-sonnet-4-20250514";
   187|}
   188|
   189|function detectAgentType(input: HookInput): string {
   190|  // Check input field
   191|  if (input.agent_type) return input.agent_type;
   192|
   193|  // Detect from environment (Claude Code sets CLAUDECODE=1, not CLAUDE_CODE)
   194|  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return "claude-code";
   195|  if (process.env.CURSOR) return "cursor";
   196|  if (process.env.GEMINI_CLI) return "gemini-cli";
   197|
   198|  // Check for Claude Code session ID from env
   199|  if (process.env.CLAUDE_CODE_SESSION_ID) return "claude-code";
   200|
   201|  // Detect from process invocation — if this hook was spawned by Claude Code's
   202|  // PostToolUse hook, the command will contain "agentmeter" and "hook".
   203|  // This catches cases where env vars (CLAUDECODE, etc.) are not inherited
   204|  // by the hook subprocess.
   205|  const argv = process.argv.join(" ").toLowerCase();
   206|  if (argv.includes("agentmeter") && argv.includes("hook")) return "claude-code";
   207|
   208|  // Check session_id format (Claude Code uses UUIDs)
   209|  if (input.session_id && typeof input.session_id === "string") {
   210|    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.session_id)) {
   211|      return "claude-code";
   212|    }
   213|    if (/^session_/i.test(input.session_id) || /^[0-9a-f]{16,}$/i.test(input.session_id)) {
   214|      return "claude-code";
   215|    }
   216|  }
   217|
   218|  // Check if cwd is provided (Claude Code sends this)
   219|  if (input.cwd) return "claude-code";
   220|
   221|  // Check if Claude Code is installed (strong signal — moved up from bottom)
   222|  if (existsSync(join(homedir(), ".claude"))) return "claude-code";
   223|
   224|  // Check model - if it's a Claude model, it's likely Claude Code
   225|  if (input.model && /claude/i.test(input.model)) return "claude-code";
   226|
   227|  return "unknown";
   228|}
   229|
   230|function createArgsSummary(args: Record<string, unknown>): string {
   231|  if (!args) return "";
   232|
   233|  const summary: Record<string, string> = {};
   234|  for (const [key, value] of Object.entries(args)) {
   235|    if (typeof value === "string") {
   236|      // Truncate long strings, mask potential secrets
   237|      if (value.length > 100) {
   238|        summary[key] = value.slice(0, 100) + "...";
   239|      } else if (/key|token|secret|password/i.test(key)) {
   240|        summary[key] = "***";
   241|      } else {
   242|        summary[key] = value;
   243|      }
   244|    } else {
   245|      summary[key] = String(value);
   246|    }
   247|  }
   248|
   249|  const str = JSON.stringify(summary);
   250|  return str.length > 500 ? str.slice(0, 500) + "..." : str;
   251|}
   252|