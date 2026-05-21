import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MeterDB } from "../db/client.js";
import { parseTokenUsage, estimateFromArguments, estimateFromContent } from "../token/counter.js";
import { estimateCost } from "../token/pricing.js";
const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
export function hookCommand() {
    let raw;
    try {
        raw = readFileSync("/dev/stdin", "utf-8");
    }
    catch {
        process.exit(0);
    }
    if (!raw.trim()) {
        process.exit(0);
    }
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch {
        process.exit(0);
    }
    const db = new MeterDB(DB_PATH);
    try {
        const timestamp = new Date().toISOString();
        const toolName = input.tool_name ?? "unknown";
        // Try to get token usage from response
        let tokenUsage = input.tool_response ? parseTokenUsage(input.tool_response) : null;
        // If no usage info, estimate from arguments and response
        const inputTokens = tokenUsage?.inputTokens ?? estimateFromArguments(input.tool_input ?? {});
        const outputTokens = tokenUsage?.outputTokens ?? (input.tool_response?.content ? estimateFromContent(input.tool_response.content) : 0);
        // Estimate cost (default to Claude Sonnet pricing)
        const cost = estimateCost(inputTokens, outputTokens);
        // Create argument summary (truncate sensitive data)
        const argsSummary = createArgsSummary(input.tool_input);
        db.insertCall({
            timestamp,
            session_id: input.session_id,
            tool_name: toolName,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            estimated_cost: cost,
            is_error: input.tool_response?.isError ?? false,
            arguments_summary: argsSummary,
        });
    }
    finally {
        db.close();
    }
    process.exit(0);
}
function createArgsSummary(args) {
    if (!args)
        return "";
    const summary = {};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") {
            // Truncate long strings, mask potential secrets
            if (value.length > 100) {
                summary[key] = value.slice(0, 100) + "...";
            }
            else if (/key|token|secret|password/i.test(key)) {
                summary[key] = "***";
            }
            else {
                summary[key] = value;
            }
        }
        else {
            summary[key] = String(value);
        }
    }
    const str = JSON.stringify(summary);
    return str.length > 500 ? str.slice(0, 500) + "..." : str;
}
//# sourceMappingURL=hook.js.map