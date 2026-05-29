/**
 * Unified adapter interface for multi-agent platform support.
 * Each agent platform (Claude Code, Codex, Cursor, etc.) implements this interface.
 */

export interface AgentAdapter {
  /** Unique identifier, e.g. "claude-code", "codex", "cursor" */
  id: string;

  /** Human-readable name */
  displayName: string;

  /** Detect if this agent is installed in the current environment */
  detect(): boolean;

  /** Initialize hook integration (write config files, etc.) */
  init(): InitResult;

  /** Remove hook integration */
  uninstall(): void;

  /** Parse raw stdin/input data into a standardized tool call record */
  parseInput(raw: unknown): ParsedToolCall | null;

  /** Detect the model being used from input data or environment */
  detectModel(input: unknown): string | undefined;
}

export interface ParsedToolCall {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResponse?: unknown;
  sessionId?: string;
  model?: string;
  agentType: string;
  cwd?: string;
  durationMs?: number;
  effort?: string;
}

export interface InitResult {
  success: boolean;
  message: string;
  instructions?: string[];
}
