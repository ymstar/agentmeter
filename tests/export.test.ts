import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MeterDB } from "../src/db/client.js";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Export", () => {
  let db: MeterDB;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentmeter-export-test-"));
    db = new MeterDB(join(tempDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports data with all fields", () => {
    db.insertCall({
      timestamp: new Date().toISOString(),
      session_id: "test-session-123",
      tool_name: "Bash",
      model: "claude-sonnet-4-20250514",
      agent_type: "claude-code",
      input_tokens: 100,
      output_tokens: 200,
      estimated_cost: 0.005,
      is_error: false,
    });

    const calls = db.getRecentCalls(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].session_id).toBe("test-session-123");
    expect(calls[0].model).toBe("claude-sonnet-4-20250514");
    expect(calls[0].agent_type).toBe("claude-code");
  });

  it("handles null fields gracefully", () => {
    db.insertCall({
      timestamp: new Date().toISOString(),
      tool_name: "Read",
      input_tokens: 50,
      output_tokens: 75,
      estimated_cost: 0.002,
      is_error: false,
    });

    const calls = db.getRecentCalls(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].session_id).toBeNull();
    expect(calls[0].model).toBeNull();
    expect(calls[0].agent_type).toBeNull();
  });
});
