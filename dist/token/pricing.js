// Model pricing per 1M tokens (USD)
export const MODEL_PRICING = {
    // Claude models (cache: read 0.1x input, write 1.25x input)
    "claude-opus-4-20250514": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    "claude-sonnet-4-20250514": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    "claude-3-opus-20240229": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    // GPT models (no cache pricing from OpenAI)
    "gpt-4o": { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
    "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
    "gpt-4-turbo": { input: 10, output: 30, cacheRead: 5, cacheWrite: 10 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5, cacheRead: 0.25, cacheWrite: 0.5 },
    // Gemini models (cache: read 0.25x input for free-tier, write = input)
    "gemini-2.5-pro": { input: 1.25, output: 10, cacheRead: 0.3125, cacheWrite: 4.25 },
    "gemini-2.5-flash": { input: 0.15, output: 0.6, cacheRead: 0.0375, cacheWrite: 0.15 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0.1 },
    // DeepSeek models
    "deepseek-v4-flash": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0.14 },
    "deepseek-v4-pro": { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 1.74 },
    "deepseek-chat": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0.14 },
    "deepseek-reasoner": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0.14 },
    "deepseek-v3.2": { input: 0.252, output: 0.378, cacheRead: 0.0252, cacheWrite: 0.252 },
    "deepseek-v3.1": { input: 0.21, output: 0.79, cacheRead: 0.13, cacheWrite: 0.21 },
    "deepseek-r1": { input: 0.7, output: 2.5, cacheRead: 0.7, cacheWrite: 0.7 },
    "deepseek-r1-0528": { input: 0.5, output: 2.15, cacheRead: 0.35, cacheWrite: 0.5 },
    // MiMo models (Xiaomi)
    "mimo-v2.5-pro": { input: 1, output: 3, cacheRead: 0.2, cacheWrite: 1 },
    "mimo-v2.5": { input: 0.4, output: 2, cacheRead: 0.08, cacheWrite: 0.4 },
    "mimo-v2-pro": { input: 1, output: 3, cacheRead: 0.2, cacheWrite: 1 },
    "mimo-v2-omni": { input: 0.4, output: 2, cacheRead: 0.08, cacheWrite: 0.4 },
    "mimo-v2-flash": { input: 0.1, output: 0.3, cacheRead: 0.01, cacheWrite: 0.1 },
    // GLM models (Zhipu AI)
    "glm-5.1": { input: 0.98, output: 3.08, cacheRead: 0.182, cacheWrite: 0.98 },
    "glm-5": { input: 0.6, output: 1.92, cacheRead: 0.12, cacheWrite: 0.6 },
    "glm-5-turbo": { input: 1.2, output: 4, cacheRead: 0.24, cacheWrite: 1.2 },
    "glm-5v-turbo": { input: 1.2, output: 4, cacheRead: 0.24, cacheWrite: 1.2 },
    "glm-4.7": { input: 0.4, output: 1.75, cacheRead: 0.08, cacheWrite: 0.4 },
    "glm-4.7-flash": { input: 0.06, output: 0.4, cacheRead: 0.01, cacheWrite: 0.06 },
    "glm-4.6": { input: 0.43, output: 1.74, cacheRead: 0.08, cacheWrite: 0.43 },
    "glm-4.6v": { input: 0.3, output: 0.9, cacheRead: 0.05, cacheWrite: 0.3 },
    "glm-4.5": { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0.6 },
    "glm-4.5-air": { input: 0.13, output: 0.85, cacheRead: 0.025, cacheWrite: 0.13 },
};
export function estimateCost(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens) {
    const pricing = model ? MODEL_PRICING[model] : null;
    const cacheCreation = cacheCreationTokens ?? 0;
    const cacheRead = cacheReadTokens ?? 0;
    // Non-cached input tokens = total input - cache creation - cache read
    const nonCachedInput = Math.max(0, inputTokens - cacheCreation - cacheRead);
    if (!pricing) {
        // Default to Claude Sonnet pricing if model unknown
        const baseCost = (nonCachedInput * 3 + outputTokens * 15) / 1_000_000;
        const cacheCost = (cacheCreation * 3.75 + cacheRead * 0.3) / 1_000_000;
        return baseCost + cacheCost;
    }
    const baseCost = (nonCachedInput * pricing.input + outputTokens * pricing.output) / 1_000_000;
    const cacheCost = (cacheCreation * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1_000_000;
    return baseCost + cacheCost;
}
//# sourceMappingURL=pricing.js.map