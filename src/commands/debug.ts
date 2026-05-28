import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function debugCommand(): void {
  const home = homedir();

  console.log("");
  console.log("  AgentMeter Debug — Model Detection Info");
  console.log("  =========================================");
  console.log("");

  // 1. Environment variables
  console.log("  [1] Environment Variables:");
  const envKeys = [
    "ANTHROPIC_MODEL",
    "CLAUDE_MODEL",
    "OPENAI_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_BASE_URL",
    "CLAUDECODE",
    "CLAUDE_CODE",
    "CURSOR",
    "GEMINI_CLI",
    "DEBUG_AGENTMETER",
  ];
  let foundEnv = false;
  for (const key of envKeys) {
    const val = process.env[key];
    if (val) {
      // Mask sensitive values
      const display = /token|key|secret|password/i.test(key) ? "***" : val;
      console.log(`    ${key} = ${display}`);
      foundEnv = true;
    }
  }
  if (!foundEnv) {
    console.log("    (none of the tracked env vars are set)");
  }
  console.log("");

  // 2. Claude Code settings files
  console.log("  [2] Claude Code Settings Files:");
  const settingsPaths = [
    join(home, ".claude", "settings.json"),
    join(home, ".claude", "settings.local.json"),
  ];

  for (const sp of settingsPaths) {
    console.log(`    ${sp}:`);
    if (!existsSync(sp)) {
      console.log("      (file not found)");
      continue;
    }
    try {
      const settings = JSON.parse(readFileSync(sp, "utf-8"));
      const model = settings?.model;
      const envModel = settings?.env?.ANTHROPIC_MODEL;
      const baseUrl = settings?.env?.ANTHROPIC_BASE_URL;
      console.log(`      model = ${model ?? "(not set)"}`);
      console.log(`      env.ANTHROPIC_MODEL = ${envModel ?? "(not set)"}`);
      console.log(`      env.ANTHROPIC_BASE_URL = ${baseUrl ?? "(not set)"}`);
    } catch (err) {
      console.log(`      (parse error: ${err instanceof Error ? err.message : String(err)})`);
    }
  }
  console.log("");

  // 3. Detection result
  console.log("  [3] Detection Result:");
  const detected = detectFromAllSources();
  console.log(`    model = ${detected ?? "(could not detect)"}`);
  console.log("");

  // 4. Recommendations
  if (!detected) {
    console.log("  [!] Could not detect model. To fix:");
    console.log("    Option A: Set ANTHROPIC_MODEL env var in ~/.claude/settings.json");
    console.log('      Add: "env": { "ANTHROPIC_MODEL": "your-model-name" }');
    console.log("    Option B: Set the top-level model in ~/.claude/settings.json");
    console.log('      Add: "model": "your-model-name"');
    console.log("");
  }
}

function detectFromAllSources(): string | undefined {
  // Mirror the same detection logic as hook.ts detectModel()
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
    if (val && val.trim()) return val.trim();
  }

  const home = homedir();
  const settingsPaths = [
    join(home, ".claude", "settings.local.json"),
    join(home, ".claude", "settings.json"),
  ];

  for (const sp of settingsPaths) {
    try {
      if (!existsSync(sp)) continue;
      const settings = JSON.parse(readFileSync(sp, "utf-8"));
      const fromEnv = settings?.env?.ANTHROPIC_MODEL;
      if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
      const fromModel = settings?.model;
      if (fromModel && typeof fromModel === "string" && fromModel.trim()) return fromModel.trim();
    } catch {
      // ignore
    }
  }

  return undefined;
}