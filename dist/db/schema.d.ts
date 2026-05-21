export declare const SCHEMA_SQL = "\nCREATE TABLE IF NOT EXISTS tool_calls (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  timestamp TEXT NOT NULL,\n  session_id TEXT,\n  tool_name TEXT NOT NULL,\n  input_tokens INTEGER DEFAULT 0,\n  output_tokens INTEGER DEFAULT 0,\n  estimated_cost REAL DEFAULT 0,\n  duration_ms INTEGER,\n  is_error INTEGER DEFAULT 0,\n  arguments_summary TEXT,\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);\n";
export interface ToolCallRecord {
    id?: number;
    timestamp: string;
    session_id?: string;
    tool_name: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
    duration_ms?: number;
    is_error: boolean;
    arguments_summary?: string;
}
export interface DailySummary {
    date: string;
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost: number;
    avg_duration: number;
}
export interface ToolStats {
    tool_name: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost: number;
    avg_duration: number;
}
//# sourceMappingURL=schema.d.ts.map