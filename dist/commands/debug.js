     1|import { readFileSync, existsSync } from "node:fs";
     2|import { homedir } from "node:os";
     3|import { join } from "node:path";
     4|export function debugCommand() {
     5|    const home = homedir();
     6|    console.log("");
     7|    console.log("  AgentMeter Debug — Model Detection Info");
     8|    console.log("  =========================================");
     9|    console.log("");
    10|    // 1. Environment variables
    11|    console.log("  [1] Environment Variables:");
    12|    const envKeys = [
    13|        "ANTHROPIC_MODEL",
    14|        "CLAUDE_MODEL",
    15|        "OPENAI_MODEL",
    16|        "ANTHROPIC_DEFAULT_SONNET_MODEL",
    17|        "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
    18|        "ANTHROPIC_DEFAULT_OPUS_MODEL",
    19|        "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
    20|        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    21|        "ANTHROPIC_BASE_URL",
    22|        "CLAUDECODE",
    23|        "CLAUDE_CODE",
    24|        "CURSOR",
    25|        "GEMINI_CLI",
    26|        "DEBUG_AGENTMETER",
    27|    ];
    28|    let foundEnv = false;
    29|    for (const key of envKeys) {
    30|        const val = process.env[key];
    31|        if (val) {
    32|            // Mask sensitive values
    33|            const display = /token|key|secret|password/i.test(key) ? "***" : val;
    34|            console.log(`    ${key} = ${display}`);
    35|            foundEnv = true;
    36|        }
    37|    }
    38|    if (!foundEnv) {
    39|        console.log("    (none of the tracked env vars are set)");
    40|    }
    41|    console.log("");
    42|    // 2. Claude Code settings files
    43|    console.log("  [2] Claude Code Settings Files:");
    44|    const settingsPaths = [
    45|        join(home, ".claude", "settings.json"),
    46|        join(home, ".claude", "settings.local.json"),
    47|    ];
    48|    for (const sp of settingsPaths) {
    49|        console.log(`    ${sp}:`);
    50|        if (!existsSync(sp)) {
    51|            console.log("      (file not found)");
    52|            continue;
    53|        }
    54|        try {
    55|            const settings = JSON.parse(readFileSync(sp, "utf-8"));
    56|            const model = settings?.model;
    57|            const envModel = settings?.env?.ANTHROPIC_MODEL;
    58|            const baseUrl = settings?.env?.ANTHROPIC_BASE_URL;
    59|            console.log(`      model = ${model ?? "(not set)"}`);
    60|            console.log(`      env.ANTHROPIC_MODEL = ${envModel ?? "(not set)"}`);
    61|            console.log(`      env.ANTHROPIC_BASE_URL = ${baseUrl ?? "(not set)"}`);
    62|        }
    63|        catch (err) {
    64|            console.log(`      (parse error: ${err instanceof Error ? err.message : String(err)})`);
    65|        }
    66|    }
    67|    console.log("");
    68|    // 3. Detection result
    69|    console.log("  [3] Detection Result:");
    70|    const detected = detectFromAllSources();
    71|    console.log(`    model = ${detected ?? "(could not detect)"}`);
    72|    console.log("");
    73|    // 4. Recommendations
    74|    if (!detected) {
    75|        console.log("  [!] Could not detect model. To fix:");
    76|        console.log("    Option A: Set ANTHROPIC_MODEL env var in ~/.claude/settings.json");
    77|        console.log('      Add: "env": { "ANTHROPIC_MODEL": "your-model-name" }');
    78|        console.log("    Option B: Set the top-level model in ~/.claude/settings.json");
    79|        console.log('      Add: "model": "your-model-name"');
    80|        console.log("");
    81|    }
    82|}
    83|function detectFromAllSources() {
    84|    // Mirror the same detection logic as hook.ts detectModel()
    85|    const envCandidates = [
    86|        "ANTHROPIC_MODEL",
    87|        "CLAUDE_MODEL",
    88|        "OPENAI_MODEL",
    89|        "ANTHROPIC_DEFAULT_SONNET_MODEL",
    90|        "ANTHROPIC_DEFAULT_OPUS_MODEL",
    91|        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    92|    ];
    93|    for (const key of envCandidates) {
    94|        const val = process.env[key];
    95|        if (val && val.trim())
    96|            return val.trim();
    97|    }
    98|    const home = homedir();
    99|    const settingsPaths = [
   100|        join(home, ".claude", "settings.local.json"),
   101|        join(home, ".claude", "settings.json"),
   102|    ];
   103|    for (const sp of settingsPaths) {
   104|        try {
   105|            if (!existsSync(sp))
   106|                continue;
   107|            const settings = JSON.parse(readFileSync(sp, "utf-8"));
   108|            const fromEnv = settings?.env?.ANTHROPIC_MODEL;
   109|            if (fromEnv && typeof fromEnv === "string" && fromEnv.trim())
   110|                return fromEnv.trim();
   111|            const fromModel = settings?.model;
   112|            if (fromModel && typeof fromModel === "string" && fromModel.trim())
   113|                return fromModel.trim();
   114|        }
   115|        catch {
   116|            // ignore
   117|        }
   118|    }
   119|    return undefined;
   120|}
   121|//# sourceMappingURL=debug.js.map