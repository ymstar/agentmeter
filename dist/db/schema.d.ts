export declare const SCHEMA_SQL = "\nCREATE TABLE IF NOT EXISTS tool_calls (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  timestamp TEXT NOT NULL,\n  session_id TEXT,\n  tool_name TEXT NOT NULL,\n  model TEXT,\n  agent_type TEXT,\n  input_tokens INTEGER DEFAULT 0,\n  output_tokens INTEGER DEFAULT 0,\n  estimated_cost REAL DEFAULT 0,\n  duration_ms INTEGER,\n  is_error INTEGER DEFAULT 0,\n  arguments_summary TEXT,\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_model ON tool_calls(model);\nCREATE INDEX IF NOT EXISTS idx_tool_calls_agent_type ON tool_calls(agent_type);\n";
export interface ToolCallRecord {
    id?: number;
    timestamp: string;
    session_id?: string;
    tool_name: string;
    model?: string;
    agent_type?: string;
    project?: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    estimated_cost: number;
    duration_ms?: number;
    effort?: string;
    is_error: boolean;
    arguments_summary?: string;
}
export interface DailySummary {
    date: string;
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_cost: number;
    avg_duration: number;
}
export interface ToolStats {
    tool_name: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_cost: number;
    avg_duration: number;
}
export interface SessionStats {
    session_id: string;
    project: string;
    first_call: string;
    last_call: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_cost: number;
    tools_used: number;
}
export interface ModelStats {
    model: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_cost: number;
}
export interface AgentStats {
    agent_type: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_cost: number;
}
//# sourceMappingURL=schema.d.ts.map