/**
 * Init command — supports multiple agent platforms.
 *
 * Usage:
 *   agentmeter init           — auto-detect and init all available agents
 *   agentmeter init claude-code — init only Claude Code
 *   agentmeter init codex       — init only Codex
 *   agentmeter init --list      — list all supported agents and their status
 */
export declare function initCommand(args?: {
    list?: boolean;
    agent?: string;
}): void;
//# sourceMappingURL=init.d.ts.map