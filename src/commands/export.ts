import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MeterDB } from "../db/client.js";

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");

interface ExportOptions {
  format?: string;
  output?: string;
  days?: string;
}

export function exportCommand(options: ExportOptions): void {
  const db = new MeterDB(DB_PATH);

  try {
    const days = options.days ? parseInt(options.days) : 30;
    const format = options.format ?? "csv";

    const calls = db.getCallsByDateRange(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    );

    if (calls.length === 0) {
      console.log("No data to export.");
      return;
    }

    let output: string;

    if (format === "json") {
      output = JSON.stringify(calls, null, 2);
    } else {
      // CSV format
      const headers = [
        "timestamp",
        "session_id",
        "tool_name",
        "model",
        "agent_type",
        "input_tokens",
        "output_tokens",
        "estimated_cost",
        "duration_ms",
        "is_error",
      ];
      const rows = calls.map(c =>
        headers.map(h => {
          const val = c[h as keyof typeof c];
          if (val === null || val === undefined) return "";
          if (typeof val === "string" && val.includes(",")) return `"${val.replace(/"/g, '""')}"`;
          return String(val);
        }).join(","),
      );
      output = [headers.join(","), ...rows].join("\n");
    }

    if (options.output) {
      writeFileSync(options.output, output);
      console.log(`Exported ${calls.length} records to ${options.output}`);
    } else {
      console.log(output);
    }
  } finally {
    db.close();
  }
}
