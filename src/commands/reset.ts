import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
const DB_WAL = join(homedir(), ".agentmeter", "meter.db-wal");
const DB_SHM = join(homedir(), ".agentmeter", "meter.db-shm");

export interface ResetOptions {
  force?: boolean;
}

export async function resetCommand(options: ResetOptions): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.log("No database found. Nothing to reset.");
    return;
  }

  if (!options.force) {
    const answer = await askConfirm(
      "This will permanently delete all recorded data. Continue? (y/N) "
    );
    if (!answer) {
      console.log("Cancelled.");
      return;
    }
  }

  // Delete database files
  for (const file of [DB_PATH, DB_WAL, DB_SHM]) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }

  console.log("Database cleared. All recorded data has been deleted.");
}

function askConfirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}
