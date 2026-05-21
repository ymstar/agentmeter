import { homedir } from "node:os";
import { join } from "node:path";
import { MeterDB } from "../db/client.js";
const DB_PATH = join(homedir(), ".agentmeter", "meter.db");
export function statsCommand() {
    const db = new MeterDB(DB_PATH);
    try {
        const overview = db.getOverview();
        const toolStats = db.getToolStats(30);
        console.log("");
        console.log("  AgentMeter - Token Usage Statistics");
        console.log("  ===================================");
        console.log("");
        // Today
        printPeriod("Today", overview.today);
        // This week
        printPeriod("This Week", overview.week);
        // This month
        printPeriod("This Month", overview.month);
        // All time
        printPeriod("All Time", overview.all_time);
        // Top tools
        if (toolStats.length > 0) {
            console.log("");
            console.log("  Top Tools (Last 30 Days)");
            console.log("  ------------------------");
            console.log("");
            console.log(`  ${"Tool".padEnd(20)} ${"Calls".padStart(8)} ${"Input".padStart(10)} ${"Output".padStart(10)} ${"Cost".padStart(10)}`);
            console.log(`  ${"─".repeat(20)} ${"─".repeat(8)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)}`);
            for (const stat of toolStats.slice(0, 10)) {
                console.log(`  ${stat.tool_name.padEnd(20)} ${String(stat.call_count).padStart(8)} ${formatTokens(stat.total_input_tokens).padStart(10)} ${formatTokens(stat.total_output_tokens).padStart(10)} ${formatCost(stat.total_cost).padStart(10)}`);
            }
        }
        console.log("");
    }
    finally {
        db.close();
    }
}
function printPeriod(label, data) {
    console.log(`  ${label}:`);
    console.log(`    Calls:         ${data.calls.toLocaleString()}`);
    console.log(`    Input Tokens:  ${formatTokens(data.input_tokens)}`);
    console.log(`    Output Tokens: ${formatTokens(data.output_tokens)}`);
    console.log(`    Total Tokens:  ${formatTokens(data.input_tokens + data.output_tokens)}`);
    console.log(`    Est. Cost:     ${formatCost(data.cost)}`);
    console.log("");
}
function formatTokens(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}
function formatCost(usd) {
    if (usd >= 1)
        return `$${usd.toFixed(2)}`;
    if (usd >= 0.01)
        return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(4)}`;
}
//# sourceMappingURL=stats.js.map