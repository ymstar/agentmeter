export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
}
export declare function parseTokenUsage(response: unknown): TokenUsage | null;
export declare function estimateTokens(text: string): number;
export declare function estimateFromArguments(args: Record<string, unknown>): number;
export declare function estimateFromContent(content: unknown[]): number;
//# sourceMappingURL=counter.d.ts.map