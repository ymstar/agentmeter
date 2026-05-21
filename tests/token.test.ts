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
      expect(usage).toEqual({ inputTokens: 100, outputTokens: 200 });
    });

    it("parses snake_case usage", () => {
      const usage = parseTokenUsage({
        usage: { input_tokens: 100, output_tokens: 200 },
      });
      expect(usage).toEqual({ inputTokens: 100, outputTokens: 200 });
    });

    it("parses direct token fields", () => {
      const usage = parseTokenUsage({
        input_tokens: 50,
        output_tokens: 75,
      });
      expect(usage).toEqual({ inputTokens: 50, outputTokens: 75 });
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
});
