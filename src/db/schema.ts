export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  session_id TEXT,
  tool_name TEXT NOT NULL,
  model TEXT,
  agent_type TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  duration_ms INTEGER,
  is_error INTEGER DEFAULT 0,
  arguments_summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_model ON tool_calls(model);
CREATE INDEX IF NOT EXISTS idx_tool_calls_agent_type ON tool_calls(agent_type);
`;

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
