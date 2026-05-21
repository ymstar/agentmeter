import { type ToolCallRecord, type DailySummary, type ToolStats } from "./schema.js";
export declare class MeterDB {
    private db;
    constructor(dbPath: string);
    insertCall(record: ToolCallRecord): number;
    getRecentCalls(limit?: number): ToolCallRecord[];
    getCallsByDateRange(start: string, end: string): ToolCallRecord[];
    getDailySummary(days?: number): DailySummary[];
    getToolStats(days?: number): ToolStats[];
    getOverview(): {
        today: {
            calls: number;
            input_tokens: number;
            output_tokens: number;
            cost: number;
        };
        week: {
            calls: number;
            input_tokens: number;
            output_tokens: number;
            cost: number;
        };
        month: {
            calls: number;
            input_tokens: number;
            output_tokens: number;
            cost: number;
        };
        all_time: {
            calls: number;
            input_tokens: number;
            output_tokens: number;
            cost: number;
        };
    };
    close(): void;
}
//# sourceMappingURL=client.d.ts.map