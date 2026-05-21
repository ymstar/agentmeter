// Model pricing per 1M tokens (USD)
export const MODEL_PRICING = {
    // Claude models
    "claude-opus-4-20250514": { input: 15, output: 75 },
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
    // GPT models
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    // Gemini models
    "gemini-2.5-pro": { input: 1.25, output: 10 },
    "gemini-2.5-flash": { input: 0.15, output: 0.6 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};
export function estimateCost(inputTokens, outputTokens, model) {
    const pricing = model ? MODEL_PRICING[model] : null;
    if (!pricing) {
        // Default to Claude Sonnet pricing if model unknown
        return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    }
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
//# sourceMappingURL=pricing.js.map