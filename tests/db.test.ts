import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MeterDB } from "../src/db/client.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MeterDB", () => {
  let db: MeterDB;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentmeter-test-"));
    db = new MeterDB(join(tempDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("inserts and retrieves a tool call", () => {
    const id = db.insertCall({
      timestamp: new Date().toISOString(),
      tool_name: "Bash",
      input_tokens: 100,
      output_tokens: 200,
      estimated_cost: 0.005,
      is_error: false,
    });

    expect(id).toBeGreaterThan(0);

    const calls = db.getRecentCalls(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].tool_name).toBe("Bash");
    expect(calls[0].input_tokens).toBe(100);
  });

  it("gets daily summary", () => {
    const now = new Date().toISOString();
    db.insertCall({
      timestamp: now,
      tool_name: "Read",
      input_tokens: 50,
      output_tokens: 100,
      estimated_cost: 0.002,
      is_error: false,
    });
    db.insertCall({
      timestamp: now,
      tool_name: "Write",
      input_tokens: 30,
      output_tokens: 60,
      estimated_cost: 0.001,
      is_error: false,
    });

    const summary = db.getDailySummary(1);
    expect(summary.length).toBeGreaterThanOrEqual(1);
    expect(summary[0].total_calls).toBe(2);
    expect(summary[0].total_input_tokens).toBe(80);
  });

  it("gets tool stats", () => {
    const now = new Date().toISOString();
    db.insertCall({
      timestamp: now,
      tool_name: "Bash",
      input_tokens: 100,
      output_tokens: 200,
      estimated_cost: 0.005,
      is_error: false,
    });
    db.insertCall({
      timestamp: now,
      tool_name: "Bash",
      input_tokens: 150,
      output_tokens: 250,
      estimated_cost: 0.007,
      is_error: false,
    });
    db.insertCall({
      timestamp: now,
      tool_name: "Read",
      input_tokens: 50,
      output_tokens: 100,
      estimated_cost: 0.002,
      is_error: false,
    });

    const stats = db.getToolStats(1);
    expect(stats.length).toBeGreaterThanOrEqual(2);

    const bashStat = stats.find((s) => s.tool_name === "Bash");
    expect(bashStat).toBeDefined();
    expect(bashStat!.call_count).toBe(2);
    expect(bashStat!.total_input_tokens).toBe(250);
  });

  it("gets overview", () => {
    const now = new Date().toISOString();
    db.insertCall({
      timestamp: now,
      tool_name: "Bash",
      input_tokens: 100,
      output_tokens: 200,
      estimated_cost: 0.005,
      is_error: false,
    });

    const overview = db.getOverview();
    expect(overview.today.calls).toBeGreaterThanOrEqual(1);
    expect(overview.month.calls).toBeGreaterThanOrEqual(1);
  });
});
