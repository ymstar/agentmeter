import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "./schema.js";
export class MeterDB {
    db;
    constructor(dbPath) {
        mkdirSync(dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.exec(SCHEMA_SQL);
    }
    insertCall(record) {
        const stmt = this.db.prepare(`
      INSERT INTO tool_calls (timestamp, session_id, tool_name, input_tokens, output_tokens, estimated_cost, duration_ms, is_error, arguments_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(record.timestamp, record.session_id ?? null, record.tool_name, record.input_tokens, record.output_tokens, record.estimated_cost, record.duration_ms ?? null, record.is_error ? 1 : 0, record.arguments_summary ?? null);
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