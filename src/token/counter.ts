export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Try to extract token usage from MCP tool call response
export function parseTokenUsage(response: unknown): TokenUsage | null {
  if (!response || typeof response !== "object") return null;

  const r = response as Record<string, unknown>;

  // Standard MCP usage field
  if (r.usage && typeof r.usage === "object") {
    const usage = r.usage as Record<string, unknown>;
    return {
      inputTokens: (usage.inputTokens ?? usage.input_tokens ?? 0) as number,
      outputTokens: (usage.outputTokens ?? usage.output_tokens ?? 0) as number,
    };
  }

  // Anthropic-style usage
  if (r.input_tokens !== undefined || r.output_tokens !== undefined) {
    return {
      inputTokens: (r.input_tokens ?? 0) as number,
      outputTokens: (r.output_tokens ?? 0) as number,
    };
  }

  return null;
}

// Estimate tokens from text (rough: 1 token ≈ 4 chars for English, 2 chars for CJK)
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let cjkCount = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 0x4e00 && code < 0x9fff) cjkCount++;
  }

  const asciiChars = text.length - cjkCount;
  return Math.ceil(asciiChars / 4 + cjkCount / 2);
}

// Estimate tokens from arguments object
export function estimateFromArguments(args: Record<string, unknown>): number {
  const text = JSON.stringify(args);
  return estimateTokens(text);
}

// Estimate tokens from content array (MCP format)
export function estimateFromContent(content: unknown[]): number {
  let total = 0;
  for (const item of content) {
    if (item && typeof item === "object") {
      const c = item as Record<string, unknown>;
      if (typeof c.text === "string") {
        total += estimateTokens(c.text);
      }
    }
  }
  return total;
}
