     1|import { readFileSync, existsSync } from "node:fs";
     2|import { homedir } from "node:os";
     3|import { join } from "node:path";
     4|
     5|export function debugCommand(): void {
     6|  const home = homedir();
     7|
     8|  console.log("");
     9|  console.log("  AgentMeter Debug — Model Detection Info");
    10|  console.log("  =========================================");
    11|  console.log("");
    12|
    13|  // 1. Environment variables
    14|  console.log("  [1] Environment Variables:");
    15|  const envKeys = [
    16|    "ANTHROPIC_MODEL",
    17|    "CLAUDE_MODEL",
    18|    "OPENAI_MODEL",
    19|    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    20|    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
    21|    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    22|    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
    23|    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    24|    "ANTHROPIC_BASE_URL",
    25|    "CLAUDECODE",
    26|    "CLAUDE_CODE",
    27|    "CURSOR",
    28|    "GEMINI_CLI",
    29|    "DEBUG_AGENTMETER",
    30|  ];
    31|  let foundEnv = false;
    32|  for (const key of envKeys) {
    33|    const val = process.env[key];
    34|    if (val) {
    35|      // Mask sensitive values
    36|      const display = /token|key|secret|password/i.test(key) ? "***" : val;
    37|      console.log(`    ${key} = ${display}`);
    38|      foundEnv = true;
    39|    }
    40|  }
    41|  if (!foundEnv) {
    42|    console.log("    (none of the tracked env vars are set)");
    43|  }
    44|  console.log("");
    45|
    46|  // 2. Claude Code settings files
    47|  console.log("  [2] Claude Code Settings Files:");
    48|  const settingsPaths = [
    49|    join(home, ".claude", "settings.json"),
    50|    join(home, ".claude", "settings.local.json"),
    51|  ];
    52|
    53|  for (const sp of settingsPaths) {
    54|    console.log(`    ${sp}:`);
    55|    if (!existsSync(sp)) {
    56|      console.log("      (file not found)");
    57|      continue;
    58|    }
    59|    try {
    60|      const settings = JSON.parse(readFileSync(sp, "utf-8"));
    61|      const model = settings?.model;
    62|      const envModel = settings?.env?.ANTHROPIC_MODEL;
    63|      const baseUrl = settings?.env?.ANTHROPIC_BASE_URL;
    64|      console.log(`      model = ${model ?? "(not set)"}`);
    65|      console.log(`      env.ANTHROPIC_MODEL = ${envModel ?? "(not set)"}`);
    66|      console.log(`      env.ANTHROPIC_BASE_URL = ${baseUrl ?? "(not set)"}`);
    67|    } catch (err) {
    68|      console.log(`      (parse error: ${err instanceof Error ? err.message : String(err)})`);
    69|    }
    70|  }
    71|  console.log("");
    72|
    73|  // 3. Detection result
    74|  console.log("  [3] Detection Result:");
    75|  const detected = detectFromAllSources();
    76|  console.log(`    model = ${detected ?? "(could not detect)"}`);
    77|  console.log("");
    78|
    79|  // 4. Recommendations
    80|  if (!detected) {
    81|    console.log("  [!] Could not detect model. To fix:");
    82|    console.log("    Option A: Set ANTHROPIC_MODEL env var in ~/.claude/settings.json");
    83|    console.log('      Add: "env": { "ANTHROPIC_MODEL": "your-model-name" }');
    84|    console.log("    Option B: Set the top-level model in ~/.claude/settings.json");
    85|    console.log('      Add: "model": "your-model-name"');
    86|    console.log("");
    87|  }
    88|}
    89|
    90|function detectFromAllSources(): string | undefined {
    91|  // Mirror the same detection logic as hook.ts detectModel()
    92|  const envCandidates = [
    93|    "ANTHROPIC_MODEL",
    94|    "CLAUDE_MODEL",
    95|    "OPENAI_MODEL",
    96|    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    97|    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    98|    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    99|  ];
   100|  for (const key of envCandidates) {
   101|    const val = process.env[key];
   102|    if (val && val.trim()) return val.trim();
   103|  }
   104|
   105|  const home = homedir();
   106|  const settingsPaths = [
   107|    join(home, ".claude", "settings.local.json"),
   108|    join(home, ".claude", "settings.json"),
   109|  ];
   110|
   111|  for (const sp of settingsPaths) {
   112|    try {
   113|      if (!existsSync(sp)) continue;
   114|      const settings = JSON.parse(readFileSync(sp, "utf-8"));
   115|      const fromEnv = settings?.env?.ANTHROPIC_MODEL;
   116|      if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
   117|      const fromModel = settings?.model;
   118|      if (fromModel && typeof fromModel === "string" && fromModel.trim()) return fromModel.trim();
   119|    } catch {
   120|      // ignore
   121|    }
   122|  }
   123|
   124|  return undefined;
   125|}
   126|