import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL, type ToolCallRecord, type DailySummary, type ToolStats, type SessionStats, type ModelStats, type AgentStats } from "./schema.js";

export class MeterDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA_SQL);
    this.migrate();
  }

  private migrate(): void {
    // Add columns if they don't exist (for existing databases)
    const columns = this.db.prepare("PRAGMA table_info(tool_calls)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes("model")) {
      this.db.exec("ALTER TABLE tool_calls ADD COLUMN model TEXT");
    }
    if (!columnNames.includes("agent_type")) {
      this.db.exec("ALTER TABLE tool_calls ADD COLUMN agent_type TEXT");
    }
  }

  insertCall(record: ToolCallRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO tool_calls (timestamp, session_id, tool_name, model, agent_type, input_tokens, output_tokens, estimated_cost, duration_ms, is_error, arguments_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.timestamp,
      record.session_id ?? null,
      record.tool_name,
      record.model ?? null,
      record.agent_type ?? null,
      record.input_tokens,
      record.output_tokens,
      record.estimated_cost,
      record.duration_ms ?? null,
      record.is_error ? 1 : 0,
      record.arguments_summary ?? null,
    );
    return Number(result.lastInsertRowid);
  }

  getRecentCalls(limit = 50): ToolCallRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tool_calls ORDER BY id DESC LIMIT ?
    `);
    return stmt.all(limit) as ToolCallRecord[];
  }

  getCallsByDateRange(start: string, end: string): ToolCallRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tool_calls WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp
    `);
    return stmt.all(start, end) as ToolCallRecord[];
  }

  getDailySummary(days = 30): DailySummary[] {
    const stmt = this.db.prepare(`
      SELECT
        date(timestamp) as date,
        COUNT(*) as total_calls,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COALESCE(AVG(duration_ms), 0) as avg_duration
      FROM tool_calls
      WHERE timestamp >= date('now', '-' || ? || ' days')
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `);
    return stmt.all(days) as DailySummary[];
  }

  getToolStats(days = 30): ToolStats[] {
    const stmt = this.db.prepare(`
      SELECT
        tool_name,
        COUNT(*) as call_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COALESCE(AVG(duration_ms), 0) as avg_duration
      FROM tool_calls
      WHERE timestamp >= date('now', '-' || ? || ' days')
      GROUP BY tool_name
      ORDER BY total_input_tokens + total_output_tokens DESC
    `);
    return stmt.all(days) as ToolStats[];
  }

  getSessionStats(days = 30): SessionStats[] {
    const stmt = this.db.prepare(`
      SELECT
        session_id,
        MIN(timestamp) as first_call,
        MAX(timestamp) as last_call,
        COUNT(*) as call_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COUNT(DISTINCT tool_name) as tools_used
      FROM tool_calls
      WHERE timestamp >= date('now', '-' || ? || ' days')
        AND session_id IS NOT NULL
        AND session_id != ''
      GROUP BY session_id
      ORDER BY last_call DESC
    `);
    return stmt.all(days) as SessionStats[];
  }

  getModelStats(days = 30): ModelStats[] {
    const stmt = this.db.prepare(`
      SELECT
        COALESCE(model, 'unknown') as model,
        COUNT(*) as call_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost
      FROM tool_calls
      WHERE timestamp >= date('now', '-' || ? || ' days')
      GROUP BY model
      ORDER BY total_input_tokens + total_output_tokens DESC
    `);
    return stmt.all(days) as ModelStats[];
  }

  getAgentStats(days = 30): AgentStats[] {
    const stmt = this.db.prepare(`
      SELECT
        COALESCE(agent_type, 'unknown') as agent_type,
        COUNT(*) as call_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost
      FROM tool_calls
      WHERE timestamp >= date('now', '-' || ? || ' days')
      GROUP BY agent_type
      ORDER BY total_input_tokens + total_output_tokens DESC
    `);
    return stmt.all(days) as AgentStats[];
  }

  getOverview(): {
    today: { calls: number; input_tokens: number; output_tokens: number; cost: number };
    week: { calls: number; input_tokens: number; output_tokens: number; cost: number };
    month: { calls: number; input_tokens: number; output_tokens: number; cost: number };
    all_time: { calls: number; input_tokens: number; output_tokens: number; cost: number };
  } {
    const query = (where: string) => {
      const row = this.db.prepare(`
        SELECT
          COUNT(*) as calls,
          COALESCE(SUM(input_tokens), 0) as input_tokens,
          COALESCE(SUM(output_tokens), 0) as output_tokens,
          COALESCE(SUM(estimated_cost), 0) as cost
        FROM tool_calls
        ${where}
      `).get() as { calls: number; input_tokens: number; output_tokens: number; cost: number };
      return row;
    };

    return {
      today: query("WHERE date(timestamp) = date('now')"),
      week: query("WHERE timestamp >= date('now', '-7 days')"),
      month: query("WHERE timestamp >= date('now', '-30 days')"),
      all_time: query(""),
    };
  }

  close(): void {
    this.db.close();
  }
}
