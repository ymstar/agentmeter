import { describe, it, expect } from "vitest";
import { estimateTokens, parseTokenUsage, estimateFromArguments, estimateFromContent } from "../src/token/counter.js";
import { estimateCost } from "../src/token/pricing.js";

describe("Token Counter", () => {
  describe("estimateTokens", () => {
    it("estimates ASCII text", () => {
      const tokens = estimateTokens("Hello, world!");
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it("estimates CJK text", () => {
      const tokens = estimateTokens("你好世界");
      // CJK: ~2 chars per token
      expect(tokens).toBe(2);
    });

    it("handles empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("handles mixed text", () => {
      const tokens = estimateTokens("Hello 你好");
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("parseTokenUsage", () => {
    it("parses standard MCP usage", () => {
      const usage = parseTokenUsage({
        usage: { inputTokens: 100, outputTokens: 200 },
      });
      expect(usage).toEqual({ inputTokens: 100, outputTokens: 200, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    });

    it("parses snake_case usage", () => {
      const usage = parseTokenUsage({
        usage: { input_tokens: 100, output_tokens: 200 },
      });
      expect(usage).toEqual({ inputTokens: 100, outputTokens: 200, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    });

    it("parses direct token fields", () => {
      const usage = parseTokenUsage({
        input_tokens: 50,
        output_tokens: 75,
      });
      expect(usage).toEqual({ inputTokens: 50, outputTokens: 75, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    });

    it("parses cache token fields", () => {
      const usage = parseTokenUsage({
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 600,
      });
      expect(usage).toEqual({ inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 200, cacheReadInputTokens: 600 });
    });

    it("returns null for no usage info", () => {
      expect(parseTokenUsage({})).toBeNull();
      expect(parseTokenUsage(null)).toBeNull();
      expect(parseTokenUsage("string")).toBeNull();
    });
  });

  describe("estimateFromArguments", () => {
    it("estimates from args object", () => {
      const tokens = estimateFromArguments({ command: "ls -la", path: "/tmp" });
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("estimateFromContent", () => {
    it("estimates from MCP content array", () => {
      const tokens = estimateFromContent([
        { type: "text", text: "Hello, world!" },
        { type: "text", text: "Another text block" },
      ]);
      expect(tokens).toBeGreaterThan(0);
    });

    it("handles empty content", () => {
      expect(estimateFromContent([])).toBe(0);
    });
  });
});

describe("Pricing", () => {
  it("calculates cost for known model", () => {
    const cost = estimateCost(1000, 500, "claude-sonnet-4-20250514");
    // (1000 * 3 + 500 * 15) / 1_000_000 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it("uses default pricing for unknown model", () => {
    const cost = estimateCost(1000, 500, "unknown-model");
    // Default: (1000 * 3 + 500 * 15) / 1_000_000 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it("handles zero tokens", () => {
    expect(estimateCost(0, 0)).toBe(0);
  });

  it("calculates cost with cache tokens", () => {
    // 1000 total input: 200 cache creation, 600 cache read, 200 non-cached
    const cost = estimateCost(1000, 500, "claude-sonnet-4-20250514", 200, 600);
    // non-cached: 200 * 3 = 600
    // cache write: 200 * 3.75 = 750
    // cache read: 600 * 0.3 = 180
    // output: 500 * 15 = 7500
    // total: (600 + 750 + 180 + 7500) / 1_000_000 = 0.00903
    expect(cost).toBeCloseTo(0.00903, 5);
  });

  it("calculates DeepSeek cache pricing", () => {
    const cost = estimateCost(1000, 500, "deepseek-v4-flash", 200, 600);
    // non-cached: 200 * 0.14 = 28
    // cache write: 200 * 0.14 = 28
    // cache read: 600 * 0.0028 = 1.68
    // output: 500 * 0.28 = 140
    // total: (28 + 28 + 1.68 + 140) / 1_000_000 = 0.00019768
    expect(cost).toBeCloseTo(0.00019768, 6);
  });
});
