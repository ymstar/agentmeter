// Try to extract token usage from MCP tool call response
export function parseTokenUsage(response) {
    if (!response || typeof response !== "object")
        return null;
    const r = response;
    // Standard MCP usage field
    if (r.usage && typeof r.usage === "object") {
        const usage = r.usage;
        return {
            inputTokens: (usage.inputTokens ?? usage.input_tokens ?? 0),
            outputTokens: (usage.outputTokens ?? usage.output_tokens ?? 0),
        };
    }
    // Anthropic-style usage
    if (r.input_tokens !== undefined || r.output_tokens !== undefined) {
        return {
            inputTokens: (r.input_tokens ?? 0),
            outputTokens: (r.output_tokens ?? 0),
        };
    }
    return null;
}
// Estimate tokens from text (rough: 1 token ≈ 4 chars for English, 2 chars for CJK)
export function estimateTokens(text) {
    if (!text)
        return 0;
    let cjkCount = 0;
    for (const char of text) {
        const code = char.charCodeAt(0);
        if (code > 0x4e00 && code < 0x9fff)
            cjkCount++;
    }
    const asciiChars = text.length - cjkCount;
    return Math.ceil(asciiChars / 4 + cjkCount / 2);
}
// Estimate tokens from arguments object
export function estimateFromArguments(args) {
    const text = JSON.stringify(args);
    return estimateTokens(text);
}
// Estimate tokens from content array (MCP format)
export function estimateFromContent(content) {
    let total = 0;
    for (const item of content) {
        if (item && typeof item === "object") {
            const c = item;
            if (typeof c.text === "string") {
                total += estimateTokens(c.text);
            }
        }
    }
    return total;
}
//# sourceMappingURL=counter.js.map