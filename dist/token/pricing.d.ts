export declare const MODEL_PRICING: Record<string, {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
}>;
export declare function estimateCost(inputTokens: number, outputTokens: number, model?: string, cacheCreationTokens?: number, cacheReadTokens?: number): number;
//# sourceMappingURL=pricing.d.ts.map