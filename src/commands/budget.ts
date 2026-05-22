import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MeterDB } from "../db/client.js";

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
const CONFIG_PATH = join(homedir(), ".agentmeter", "config.json");

interface BudgetConfig {
  daily_limit_usd?: number;
  monthly_limit_usd?: number;
  daily_limit_tokens?: number;
  monthly_limit_tokens?: number;
  warn_at_percent?: number;
}

interface BudgetStatus {
  daily: { spent: number; limit: number; percent: number; tokens: number; token_limit: number };
  monthly: { spent: number; limit: number; percent: number; tokens: number; token_limit: number };
  warnings: string[];
}

export function loadConfig(): BudgetConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {
      daily_limit_usd: 10,
      monthly_limit_usd: 100,
      warn_at_percent: 80,
    };
  }

  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as BudgetConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: BudgetConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function checkBudget(): BudgetStatus {
  const config = loadConfig();
  const db = new MeterDB(DB_PATH);

  try {
    const overview = db.getOverview();

    const dailyLimit = config.daily_limit_usd ?? 10;
    const monthlyLimit = config.monthly_limit_usd ?? 100;
    const dailyTokenLimit = config.daily_limit_tokens ?? 0;
    const monthlyTokenLimit = config.monthly_limit_tokens ?? 0;
    const warnAt = config.warn_at_percent ?? 80;

    const dailySpent = overview.today.cost;
    const monthlySpent = overview.month.cost;
    const dailyTokens = overview.today.input_tokens + overview.today.output_tokens;
    const monthlyTokens = overview.month.input_tokens + overview.month.output_tokens;

    const dailyPercent = dailyLimit > 0 ? (dailySpent / dailyLimit) * 100 : 0;
    const monthlyPercent = monthlyLimit > 0 ? (monthlySpent / monthlyLimit) * 100 : 0;

    const warnings: string[] = [];

    if (dailyPercent >= 100) {
      warnings.push(`Daily budget exceeded! Spent $${dailySpent.toFixed(2)} of $${dailyLimit.toFixed(2)}`);
    } else if (dailyPercent >= warnAt) {
      warnings.push(`Daily budget warning: ${dailyPercent.toFixed(0)}% used ($${dailySpent.toFixed(2)} of $${dailyLimit.toFixed(2)})`);
    }

    if (monthlyPercent >= 100) {
      warnings.push(`Monthly budget exceeded! Spent $${monthlySpent.toFixed(2)} of $${monthlyLimit.toFixed(2)}`);
    } else if (monthlyPercent >= warnAt) {
      warnings.push(`Monthly budget warning: ${monthlyPercent.toFixed(0)}% used ($${monthlySpent.toFixed(2)} of $${monthlyLimit.toFixed(2)})`);
    }

    if (dailyTokenLimit > 0 && dailyTokens >= dailyTokenLimit) {
      warnings.push(`Daily token limit exceeded! Used ${formatTokens(dailyTokens)} of ${formatTokens(dailyTokenLimit)}`);
    }

    if (monthlyTokenLimit > 0 && monthlyTokens >= monthlyTokenLimit) {
      warnings.push(`Monthly token limit exceeded! Used ${formatTokens(monthlyTokens)} of ${formatTokens(monthlyTokenLimit)}`);
    }

    return {
      daily: { spent: dailySpent, limit: dailyLimit, percent: dailyPercent, tokens: dailyTokens, token_limit: dailyTokenLimit },
      monthly: { spent: monthlySpent, limit: monthlyLimit, percent: monthlyPercent, tokens: monthlyTokens, token_limit: monthlyTokenLimit },
      warnings,
    };
  } finally {
    db.close();
  }
}

export function budgetCommand(): void {
  const status = checkBudget();

  console.log("");
  console.log("  AgentMeter - Budget Status");
  console.log("  ==========================");
  console.log("");
  console.log("  Daily:");
  console.log(`    Cost:    $${status.daily.spent.toFixed(4)} / $${status.daily.limit.toFixed(2)} (${status.daily.percent.toFixed(1)}%)`);
  if (status.daily.token_limit > 0) {
    console.log(`    Tokens:  ${formatTokens(status.daily.tokens)} / ${formatTokens(status.daily.token_limit)}`);
  }
  console.log("");
  console.log("  Monthly:");
  console.log(`    Cost:    $${status.monthly.spent.toFixed(4)} / $${status.monthly.limit.toFixed(2)} (${status.monthly.percent.toFixed(1)}%)`);
  if (status.monthly.token_limit > 0) {
    console.log(`    Tokens:  ${formatTokens(status.monthly.tokens)} / ${formatTokens(status.monthly.token_limit)}`);
  }

  if (status.warnings.length > 0) {
    console.log("");
    console.log("  Warnings:");
    for (const warning of status.warnings) {
      console.log(`    ⚠ ${warning}`);
    }
  }

  console.log("");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
