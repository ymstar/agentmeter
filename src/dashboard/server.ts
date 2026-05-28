import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { MeterDB } from "../db/client.js";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"));

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
const STATIC_DIR = join(import.meta.dirname, "static");

export interface DashboardOptions {
  port: number;
}

export function dashboardCommand(options: DashboardOptions): void {
  const port = options.port;
  const db = new MeterDB(DB_PATH);

  const server = createServer((req, res) => {
    try {
      handleRequest(req, res, db);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("");
      console.error(`  ✗ Error: Port ${port} is already in use.`);
      console.error("");
      console.error("  Try one of these:");
      console.error(`    1. Use a different port:  agentmeter dashboard -p ${port + 1}`);
      console.error(`    2. Kill the process:      lsof -ti:${port} | xargs kill -9`);
      console.error("");
    } else {
      console.error("Dashboard server error:", err.message);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log("");
    console.log("  AgentMeter Dashboard");
    console.log(`  http://localhost:${port}`);
    console.log("");
    console.log("  Press Ctrl+C to stop");
    console.log("");
  });

  // Graceful shutdown
  const shutdown = () => {
    db.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function handleRequest(req: IncomingMessage, res: ServerResponse, db: MeterDB): void {
  const url = new URL(req.url ?? "/", `http://localhost`);

  // API endpoints
  if (url.pathname === "/api/version") {
    sendJson(res, 200, { version: pkg.version });
    return;
  }

  if (url.pathname === "/api/overview") {
    sendJson(res, 200, db.getOverview());
    return;
  }

  if (url.pathname === "/api/daily") {
    const days = parseInt(url.searchParams.get("days") ?? "30");
    sendJson(res, 200, db.getDailySummary(days));
    return;
  }

  if (url.pathname === "/api/tools") {
    const days = parseInt(url.searchParams.get("days") ?? "30");
    sendJson(res, 200, db.getToolStats(days));
    return;
  }

  if (url.pathname === "/api/sessions") {
    const days = parseInt(url.searchParams.get("days") ?? "30");
    sendJson(res, 200, db.getSessionStats(days));
    return;
  }

  if (url.pathname === "/api/models") {
    const days = parseInt(url.searchParams.get("days") ?? "30");
    sendJson(res, 200, db.getModelStats(days));
    return;
  }

  if (url.pathname === "/api/agents") {
    const days = parseInt(url.searchParams.get("days") ?? "30");
    sendJson(res, 200, db.getAgentStats(days));
    return;
  }

  if (url.pathname === "/api/calls") {
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    sendJson(res, 200, db.getRecentCalls(limit));
    return;
  }

  // Static files
  if (url.pathname === "/" || url.pathname === "/index.html") {
    serveFile(res, join(STATIC_DIR, "index.html"), "text/html");
    return;
  }

  if (url.pathname === "/app.js") {
    serveFile(res, join(STATIC_DIR, "app.js"), "application/javascript");
    return;
  }

  if (url.pathname === "/style.css") {
    serveFile(res, join(STATIC_DIR, "style.css"), "text/css");
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function serveFile(res: ServerResponse, path: string, contentType: string): void {
  try {
    const content = readFileSync(path);
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
