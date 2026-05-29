/**
 * Debug command — shows model detection and agent status info.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAllAdapters, detectAvailableAdapters } from "../adapters/index.js";

export function debugCommand(): void {
  const home = homedir();

  console.log("");
  console.log("  AgentMeter Debug — Agent & Model Detection");
  console.log("  ===========================================");
  console.log("");

  // 1. Detected agents
  console.log("  [1] Agent Platforms:");
  const allAdapters = getAllAdapters();
  const available = detectAvailableAdapters();
  for (const adapter of allAdapters) {
    const detected = available.includes(adapter);
    const status = detected ? "✅ detected" : "❌ not found";
    console.log(`    ${adapter.id.padEnd(15)} ${adapter.displayName.padEnd(20)} ${status}`);
  }
  console.log("");

  // 2. Environment variables
  console.log("  [2] Environment Variables:");
  const envKeys = [
    "ANTHROPIC_MODEL",
    "CLAUDE_MODEL",
    "OPENAI_MODEL",
    "OPENAI_API_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_BASE_URL",
    "OPENAI_API_KEY",
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
      const display = /token|key|secret|password/i.test(key) ? "***" : val;
      console.log(`    ${key} = ${display}`);
      foundEnv = true;
    }
  }
  if (!foundEnv) {
    console.log("    (none of the tracked env vars are set)");
  }
  console.log("");

  // 3. Claude Code settings
  console.log("  [3] Claude Code Settings:");
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
      console.log(`      model = ${model ?? "(not set)"}`);
      console.log(`      env.ANTHROPIC_MODEL = ${envModel ?? "(not set)"}`);
    } catch (err) {
      console.log(`      (parse error: ${err instanceof Error ? err.message : String(err)})`);
    }
  }
  console.log("");

  // 4. Codex settings
  console.log("  [4] Codex CLI Settings:");
  const codexConfigPath = join(home, ".codex", "config.json");
  if (existsSync(codexConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(codexConfigPath, "utf-8"));
      console.log(`    model = ${config?.model ?? "(not set)"}`);
    } catch {
      console.log("    (parse error)");
    }
  } else {
    console.log("    (no config found)");
  }
  console.log("");

  // 5. Model detection result
  console.log("  [5] Model Detection:");
  for (const adapter of available) {
    const model = adapter.detectModel({});
    console.log(`    ${adapter.id}: ${model ?? "(could not detect)"}`);
  }
  console.log("");
}
