     1|#!/usr/bin/env node
     2|import { parseArgs } from "node:util";
     3|import { initCommand } from "./commands/init.js";
     4|import { hookCommand } from "./commands/hook.js";
     5|import { statsCommand } from "./commands/stats.js";
     6|import { exportCommand } from "./commands/export.js";
     7|import { budgetCommand } from "./commands/budget.js";
     8|import { dashboardCommand } from "./dashboard/server.js";
     9|import { resetCommand } from "./commands/reset.js";
    10|import { debugCommand } from "./commands/debug.js";
    11|const { values, positionals } = parseArgs({
    12|    args: process.argv.slice(2),
    13|    options: {
    14|        port: { type: "string", short: "p" },
    15|        format: { type: "string", short: "f" },
    16|        output: { type: "string", short: "o" },
    17|        days: { type: "string", short: "d" },
    18|        force: { type: "boolean" },
    19|        help: { type: "boolean", short: "h" },
    20|    },
    21|    allowPositionals: true,
    22|    strict: false,
    23|});
    24|const command = positionals[0] ?? "help";
    25|if (values.help && command === "help") {
    26|    printHelp();
    27|    process.exit(0);
    28|}
    29|async function main() {
    30|    switch (command) {
    31|        case "init":
    32|            initCommand();
    33|            break;
    34|        case "hook":
    35|            hookCommand();
    36|            break;
    37|        case "stats":
    38|            statsCommand();
    39|            break;
    40|        case "export":
    41|            exportCommand({
    42|                format: values.format,
    43|                output: values.output,
    44|                days: values.days,
    45|            });
    46|            break;
    47|        case "budget":
    48|            budgetCommand();
    49|            break;
    50|        case "dashboard":
    51|            dashboardCommand({
    52|                port: values.port ? parseInt(values.port, 10) : 3940,
    53|            });
    54|            break;
    55|        case "reset":
    56|            await resetCommand({ force: !!values.force });
    57|            break;
    58|        case "debug":
    59|            debugCommand();
    60|            break;
    61|        case "help":
    62|        case "--help":
    63|        case "-h":
    64|            printHelp();
    65|            break;
    66|        default:
    67|            console.error(`Unknown command: ${command}`);
    68|            printHelp();
    69|            process.exit(1);
    70|    }
    71|}
    72|function printHelp() {
    73|    console.log(`
    74|  AgentMeter - Token Usage Tracking for AI Agents
    75|
    76|  Usage:
    77|    agentmeter <command> [options]
    78|
    79|  Commands:
    80|    init         Configure Claude Code hooks (one-time setup)
    81|    stats        Show token usage statistics in terminal
    82|    dashboard    Launch web dashboard (default port 3940)
    83|    budget       Check budget status and warnings
    84|    export       Export data to CSV or JSON
    85|    reset        Clear all recorded data and start fresh
    86|    debug        Show model detection debug info
    87|    hook         Internal: called by Claude Code hooks
    88|
    89|  Options:
    90|    -p, --port <port>      Dashboard port (default: 3940)
    91|    -f, --format <format>  Export format: csv (default), json
    92|    -o, --output <file>    Output file (default: stdout)
    93|    -d, --days <n>         Number of days to export (default: 30)
    94|    -h, --help             Show this help
    95|
    96|  Quick Start:
    97|    npx @ymstar/agentmeter init
    98|    npx @ymstar/agentmeter dashboard
    99|    npx @ymstar/agentmeter export -f csv -o data.csv
   100|  `);
   101|}
   102|main().catch((err) => {
   103|    console.error("Fatal error:", err);
   104|    process.exit(1);
   105|});
   106|//# sourceMappingURL=index.js.map