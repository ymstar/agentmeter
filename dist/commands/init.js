import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function initCommand() {
    const claudeDir = join(homedir(), ".claude");
    const settingsPath = join(claudeDir, "settings.json");
    if (!existsSync(settingsPath)) {
        console.error("Claude Code settings not found at ~/.claude/settings.json");
        console.error("Please run Claude Code first, then try again.");
        process.exit(1);
    }
    let settings;
    try {
        settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    }
    catch {
        console.error("Failed to parse settings.json");
        process.exit(1);
    }
    // Ensure hooks structure exists
    if (!settings.hooks)
        settings.hooks = {};
    const hooks = settings.hooks;
    // Add PostToolUse hook for agentmeter
    const hookEntry = {
        matcher: ".*",
        hooks: [
            {
                type: "command",
                command: "npx -y @ymstar/agentmeter hook",
            },
        ],
    };
    if (!hooks.PostToolUse) {
        hooks.PostToolUse = [hookEntry];
    }
    else {
        const postToolUse = hooks.PostToolUse;
        // Check if already configured
        const exists = postToolUse.some((h) => h.hooks &&
            Array.isArray(h.hooks) &&
            h.hooks.some((hook) => typeof hook.command === "string" && hook.command.includes("agentmeter")));
        if (!exists) {
            postToolUse.push(hookEntry);
        }
    }
    settings.hooks = hooks;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log("AgentMeter configured successfully!");
    console.log("");
    console.log("  PostToolUse hook added to ~/.claude/settings.json");
    console.log("  Data will be stored at ~/.agentmeter/meter.db");
    console.log("");
    console.log("  Run 'npx @ymstar/agentmeter dashboard' to view stats");
    console.log("  Run 'npx @ymstar/agentmeter stats' for terminal view");
}
//# sourceMappingURL=init.js.map