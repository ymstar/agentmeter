import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class MeterDB {
    db;
    constructor(dbPath) {
        mkdirSync(dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        // Create table first (without indexes), then migrate, then add indexes
        this.db.exec(`CREATE TABLE IF NOT EXISTS tool_calls (
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
    )`);
        this.migrate();
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_calls_timestamp ON tool_calls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_model ON tool_calls(model);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_agent_type ON tool_calls(agent_type);`);
    }
    migrate() {
        // Add columns if they don't exist (for existing databases)
        const columns = this.db.prepare("PRAGMA table_info(tool_calls)").all();
        const columnNames = columns.map(c => c.name);
        if (!columnNames.includes("model")) {
            this.db.exec("ALTER TABLE tool_calls ADD COLUMN model TEXT");
        }
        if (!columnNames.includes("agent_type")) {
            this.db.exec("ALTER TABLE tool_calls ADD COLUMN agent_type TEXT");
        }
    }
    insertCall(record) {
        const stmt = this.db.prepare(`
      INSERT INTO tool_calls (timestamp, session_id, tool_name, model, agent_type, input_tokens, output_tokens, estimated_cost, duration_ms, is_error, arguments_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(record.timestamp, record.session_id ?? null, record.tool_name, record.model ?? null, record.agent_type ?? null, record.input_tokens, record.output_tokens, record.estimated_cost, record.duration_ms ?? null, record.is_error ? 1 : 0, record.arguments_summary ?? null);
        return Number(result.lastInsertRowid);
    }
    getRecentCalls(limit = 50) {
        const stmt = this.db.prepare(`
      SELECT * FROM tool_calls ORDER BY id DESC LIMIT ?
    `);
        return stmt.all(limit);
    }
    getCallsByDateRange(start, end) {
        const stmt = this.db.prepare(`
      SELECT * FROM tool_calls WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp
    `);
        return stmt.all(start, end);
    }
    getDailySummary(days = 30) {
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
        return stmt.all(days);
    }
    getToolStats(days = 30) {
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
        return stmt.all(days);
    }
    getSessionStats(days = 30) {
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
        return stmt.all(days);
    }
    getModelStats(days = 30) {
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
        return stmt.all(days);
    }
    getAgentStats(days = 30) {
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
        return stmt.all(days);
    }
    getOverview() {
        const query = (where) => {
            const row = this.db.prepare(`
        SELECT
          COUNT(*) as calls,
          COALESCE(SUM(input_tokens), 0) as input_tokens,
          COALESCE(SUM(output_tokens), 0) as output_tokens,
          COALESCE(SUM(estimated_cost), 0) as cost
        FROM tool_calls
        ${where}
      `).get();
            return row;
        };
        return {
            today: query("WHERE date(timestamp) = date('now')"),
            week: query("WHERE timestamp >= date('now', '-7 days')"),
            month: query("WHERE timestamp >= date('now', '-30 days')"),
            all_time: query(""),
        };
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=client.js.map