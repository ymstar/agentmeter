import { readFileSync } from "node:fs";

export function hookDebugCommand(): void {
  let raw: string;
  try {
    raw = readFileSync("/dev/stdin", "utf-8");
  } catch {
    console.error("No stdin");
    process.exit(0);
  }

  if (!raw.trim()) {
    console.error("Empty stdin");
    process.exit(0);
  }

  console.log("=== Raw Input ===");
  console.log(raw.slice(0, 2000));
  console.log("\n=== Parsed ===");
  try {
    const input = JSON.parse(raw);
    console.log(JSON.stringify(input, null, 2).slice(0, 3000));
  } catch (e) {
    console.error("Parse error:", e);
  }
}
