# AgentMeter 多 Agent 平台支持方案

## 1. 架构设计

### 核心思路：适配器模式

```
┌─────────────────────────────────────────────────────┐
│                   agentmeter CLI                    │
│  init [agent] | hook | stats | dashboard | export   │
├─────────────────────────────────────────────────────┤
│                 Adapter Layer (NEW)                  │
│  ┌───────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐ │
│  │ claude-code│ │  codex   │ │cursor │ │  cline   │ │
│  │  adapter   │ │ adapter  │ │adapter│ │ adapter  │ │
│  └─────┬─────┘ └────┬─────┘ └───┬───┘ └────┬─────┘ │
├────────┼────────────┼──────────┼───────────┼────────┤
│        └────────────┼──────────┘           │        │
│              Unified Hook Entry            │        │
│            (src/commands/hook.ts)          │        │
├─────────────────────┴──────────────────────┘────────┤
│              Data Layer (unchanged)                  │
│   MeterDB (SQLite) → stats | dashboard | export     │
└─────────────────────────────────────────────────────┘
```

### 文件结构

```
src/
  adapters/
    types.ts          # 统一适配器接口定义
    registry.ts       # 适配器注册和发现
    claude-code.ts    # Claude Code 适配器（从现有代码提取）
    codex.ts          # OpenAI Codex 适配器
    cursor.ts         # Cursor 适配器
    cline.ts          # Cline 适配器
    generic.ts        # 通用 HTTP/MCP 适配器
  commands/
    init.ts           # 改造：支持多 agent 初始化
    hook.ts           # 改造：使用适配器层
    ...
```

## 2. 统一适配器接口

```typescript
// src/adapters/types.ts
export interface AgentAdapter {
  /** 唯一标识，如 "claude-code", "codex", "cursor" */
  id: string;

  /** 人类可读名称 */
  displayName: string;

  /** 检测当前环境是否安装了该 agent */
  detect(): boolean;

  /** 初始化 hook 集成（写入配置文件等） */
  init(): InitResult;

  /** 移除 hook 集成 */
  uninstall(): void;

  /** 从原始输入数据中提取标准化的工具调用信息 */
  parseInput(raw: unknown): ParsedToolCall | null;

  /** 检测当前使用的模型 */
  detectModel(input: unknown): string | undefined;

  /** 检测 agent 类型标识符 */
  detectAgentType(): string;
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
  // 各平台可能有额外字段
  extra?: Record<string, unknown>;
}

export interface InitResult {
  success: boolean;
  message: string;
  instructions?: string[];  // 需要用户手动执行的步骤
}
```

## 3. 各平台集成方案

### 3.1 Claude Code（现有，重构提取）

**机制：** PostToolUse hook → stdin JSON
**改动：** 将 `hook.ts` 中的检测逻辑提取到 `adapters/claude-code.ts`
**影响：** 向后兼容，用户无感知

### 3.2 OpenAI Codex CLI

**机制：MCP Server 方案**

Codex 支持 MCP（Model Context Protocol）。我们可以创建一个 MCP server，它：
- 提供代理工具（wrap 原始工具）
- 每次工具调用时记录数据到 agentmeter

```typescript
// src/adapters/codex.ts
export class CodexAdapter implements AgentAdapter {
  id = "codex";
  displayName = "OpenAI Codex";

  detect(): boolean {
    // 检查 codex CLI 是否安装
    return existsSync(join(homedir(), ".codex")) || which("codex") !== null;
  }

  init(): InitResult {
    // 方案 A: 注册 MCP server（推荐）
    // codex mcp add agentmeter -- npx -y @ymstar/agentmeter mcp-server
    //
    // 方案 B: Wrapper script
    // 把 `codex` 命令包装一层，在每次执行后调用 agentmeter hook
    //
    // 方案 C: 解析 Codex 的 transcript/log 文件（最通用但最不实时）

    return {
      success: true,
      message: "Codex adapter configured via MCP server",
      instructions: [
        "Run: codex mcp add agentmeter -- npx -y @ymstar/agentmeter mcp-server",
      ]
    };
  }
}
```

**MCP Server 方案详情：**

```
Codex CLI ──calls tool──→ MCP Server (agentmeter) ──proxies──→ 原始工具
                              │
                              ├── 记录 tool_name, input, output
                              ├── 估算 tokens
                              └── 写入 meter.db
```

新增命令：`agentmeter mcp-server` — 作为 MCP server 运行，拦截工具调用

### 3.3 Cursor

**机制：MCP Server + Rules File**

Cursor 支持：
1. MCP servers（通过 `~/.cursor/mcp.json`）
2. Rules files（`.cursorrules`）

```typescript
// src/adapters/cursor.ts
export class CursorAdapter implements AgentAdapter {
  id = "cursor";
  displayName = "Cursor";

  detect(): boolean {
    // 检查 Cursor 配置目录
    return existsSync(join(homedir(), ".cursor"));
  }

  init(): InitResult {
    // 写入 MCP server 配置到 ~/.cursor/mcp.json
    const mcpConfig = {
      mcpServers: {
        agentmeter: {
          command: "npx",
          args: ["-y", "@ymstar/agentmeter", "mcp-server"],
        }
      }
    };
    // 合并写入 ~/.cursor/mcp.json
    return { success: true, message: "Cursor MCP server configured" };
  }
}
```

**问题：** Cursor 的 MCP 工具调用不会经过 agentmeter 的 MCP server（MCP server 是提供工具，不是拦截工具）。

**更好的方案：** 利用 Cursor 的 `settings.json` 或 rules 文件注入监控逻辑。
或者：提供一个本地 HTTP API，让 agent 通过 MCP tool 主动上报。

### 3.4 通用方案：HTTP API + MCP Tool

**最通用的方案，适用于所有支持 MCP 的 agent：**

```
agentmeter daemon start    # 启动本地 HTTP API (localhost:3941)
agentmeter mcp-tool        # 提供 MCP tool: "log_tool_call"
```

任何 agent 都可以通过调用 MCP tool 或 HTTP API 上报数据：

```json
// MCP tool 调用
{
  "tool_name": "log_tool_call",
  "arguments": {
    "tool": "Read",
    "input": {"file": "src/main.ts"},
    "output": "...",
    "model": "claude-sonnet-4",
    "session_id": "xxx"
  }
}
```

**HTTP API：**
```
POST http://localhost:3941/api/log
{
  "tool": "Read",
  "input_tokens": 100,
  "output_tokens": 500,
  "model": "claude-sonnet-4",
  "agent": "cursor",
  "session_id": "xxx"
}
```

## 4. CLI 设计

```bash
# 初始化（自动检测可用 agent）
agentmeter init                    # 检测所有已安装的 agent，全部初始化
agentmeter init claude-code        # 只初始化 Claude Code
agentmeter init codex              # 只初始化 Codex
agentmeter init cursor             # 只初始化 Cursor
agentmeter init --list             # 列出所有支持的 agent 及其状态

# 查看状态
agentmeter status                  # 显示各 agent 的连接状态

# 卸载
agentmeter uninstall claude-code   # 移除 Claude Code hook
agentmeter uninstall --all         # 移除所有 hook

# 守护进程（HTTP API 模式）
agentmeter daemon start            # 启动本地 API server
agentmeter daemon stop             # 停止
agentmeter daemon status           # 查看状态
```

## 5. 数据模型扩展

```sql
-- 已有字段足够，agent_type 区分来源
-- 新增可能的字段：
ALTER TABLE tool_calls ADD COLUMN agent_version TEXT;  -- agent 版本
ALTER TABLE tool_calls ADD COLUMN provider TEXT;        -- API provider (openai, anthropic, etc.)
ALTER TABLE tool_calls ADD COLUMN cost_currency TEXT DEFAULT 'USD';
```

## 6. 实现优先级

### Phase 1：重构 + Codex（1-2 天）
- [ ] 提取适配器接口 `src/adapters/types.ts`
- [ ] 提取 Claude Code 适配器 `src/adapters/claude-code.ts`
- [ ] 重构 `init.ts` 支持 `agentmeter init [agent]`
- [ ] 重构 `hook.ts` 使用适配器
- [ ] 实现 Codex 适配器（stdin wrapper 方案）
- [ ] 测试 + 发布 v0.4.0

### Phase 2：MCP Server + Cursor（2-3 天）
- [ ] 实现 `agentmeter mcp-server` 命令
- [ ] 实现 Cursor 适配器（MCP + mcp.json 配置）
- [ ] 实现 HTTP API daemon 模式
- [ ] 测试 + 发布 v0.5.0

### Phase 3：更多平台 + 优化（持续）
- [ ] Cline 适配器
- [ ] Windsurf 适配器
- [ ] Aider 适配器
- [ ] 通用 MCP tool 方案
- [ ] Dashboard 多 agent 视图

## 7. 坑和注意事项

1. **MCP Server 不是 Proxy** — MCP server 提供新工具，不能拦截已有工具调用。所以 MCP 方案需要 agent 主动调用 agentmeter 的工具，或者 agent 自身支持 hook 机制。

2. **Codex 的 stdin 问题** — Codex 是交互式 TUI，不像 Claude Code 有 PostToolUse hook。需要用 wrapper 或 transcript 解析。

3. **Cursor 的封闭性** — Cursor 没有公开的 hook API。最可靠的方案是解析其日志文件或使用 MCP tool 主动上报。

4. **Token 估算准确性** — 不同 agent 返回的 usage 数据格式不同，需要针对性适配。

5. **多实例冲突** — 用户可能同时运行多个 agent，SQLite WAL 模式可以处理并发写入。

6. **macOS 兼容性** — 所有新的 stdin/进程通信方案都需要在 macOS 上测试。

## 8. 推荐方案

**短期（最大收益）：** Codex stdin wrapper
- 最像 Claude Code 的集成方式
- Codex 有 `exec` 模式，可以像 Claude Code 一样通过 wrapper 捕获数据

**中期（最通用）：** HTTP API daemon + MCP tool
- 适用于所有支持 MCP 的 agent
- agent 主动上报，不需要 hook 机制
- 也可以被自定义脚本调用

**长期（最完整）：** 适配器 + daemon + MCP 组合
- 每个 agent 用最合适的方案
- 统一数据存储和展示
