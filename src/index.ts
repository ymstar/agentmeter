     1|#!/usr/bin/env node
     2|
     3|import { parseArgs } from "node:util";
     4|import { initCommand } from "./commands/init.js";
     5|import { hookCommand } from "./commands/hook.js";
     6|import { statsCommand } from "./commands/stats.js";
     7|import { exportCommand } from "./commands/export.js";
     8|import { budgetCommand } from "./commands/budget.js";
     9|import { dashboardCommand } from "./dashboard/server.js";
    10|import { resetCommand } from "./commands/reset.js";
    11|import { debugCommand } from "./commands/debug.js";
    12|
    13|const { values, positionals } = parseArgs({
    14|  args: process.argv.slice(2),
    15|  options: {
    16|    port: { type: "string", short: "p" },
    17|    format: { type: "string", short: "f" },
    18|    output: { type: "string", short: "o" },
    19|    days: { type: "string", short: "d" },
    20|    force: { type: "boolean" },
    21|    help: { type: "boolean", short: "h" },
    22|  },
    23|  allowPositionals: true,
    24|  strict: false,
    25|});
    26|
    27|const command = positionals[0] ?? "help";
    28|
    29|if (values.help && command === "help") {
    30|  printHelp();
    31|  process.exit(0);
    32|}
    33|
    34|async function main() {
    35|  switch (command) {
    36|    case "init":
    37|      initCommand();
    38|      break;
    39|
    40|    case "hook":
    41|      hookCommand();
    42|      break;
    43|
    44|    case "stats":
    45|      statsCommand();
    46|      break;
    47|
    48|    case "export":
    49|      exportCommand({
    50|        format: values.format as string | undefined,
    51|        output: values.output as string | undefined,
    52|        days: values.days as string | undefined,
    53|      });
    54|      break;
    55|
    56|    case "budget":
    57|      budgetCommand();
    58|      break;
    59|
    60|    case "dashboard":
    61|      dashboardCommand({
    62|        port: values.port ? parseInt(values.port as string, 10) : 3940,
    63|      });
    64|      break;
    65|
    66|    case "reset":
    67|      await resetCommand({ force: !!values.force });
    68|      break;
    69|
    70|    case "debug":
    71|      debugCommand();
    72|      break;
    73|
    74|    case "help":
    75|    case "--help":
    76|    case "-h":
    77|      printHelp();
    78|      break;
    79|
    80|    default:
    81|      console.error(`Unknown command: ${command}`);
    82|      printHelp();
    83|      process.exit(1);
    84|  }
    85|}
    86|
    87|function printHelp() {
    88|  console.log(`
    89|  AgentMeter - Token Usage Tracking for AI Agents
    90|
    91|  Usage:
    92|    agentmeter <command> [options]
    93|
    94|  Commands:
    95|    init         Configure Claude Code hooks (one-time setup)
    96|    stats        Show token usage statistics in terminal
    97|    dashboard    Launch web dashboard (default port 3940)
    98|    budget       Check budget status and warnings
    99|    export       Export data to CSV or JSON
   100|    reset        Clear all recorded data and start fresh
   101|    debug        Show model detection debug info
   102|    hook         Internal: called by Claude Code hooks
   103|
   104|  Options:
   105|    -p, --port <port>      Dashboard port (default: 3940)
   106|    -f, --format <format>  Export format: csv (default), json
   107|    -o, --output <file>    Output file (default: stdout)
   108|    -d, --days <n>         Number of days to export (default: 30)
   109|    -h, --help             Show this help
   110|
   111|  Quick Start:
   112|    npx @ymstar/agentmeter init
   113|    npx @ymstar/agentmeter dashboard
   114|    npx @ymstar/agentmeter export -f csv -o data.csv
   115|  `);
   116|}
   117|
   118|main().catch((err) => {
   119|  console.error("Fatal error:", err);
   120|  process.exit(1);
   121|});
   122|