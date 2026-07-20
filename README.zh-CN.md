# Skill Monitor

[English](./README.md) | **中文**

[![skills.sh](https://skills.sh/b/wei63w/skill-monitor)](https://skills.sh/wei63w/skill-monitor)

用于统计本地 Agent Skill 实际使用情况的 Skill：调用次数、从未使用的 skill、**SKILL.md 粗估 token**、**Rules / AGENTS.md 膨胀**、**Task / 子 Agent 启动成本**、项目内频率报告。

Agent 会加载很多 skill，团队却很少知道哪些真正有用。没有账本时，「我们有 80 个 skill」只能靠感觉：全留着、凭印象、从不清理。

Skill Monitor 给 Agent 一条本地流水线：**record → backfill → analyze**。扫描磁盘上的 skill、尽力计数加载次数，并输出含 **0 次使用** 项的 Markdown 频率表。

兼容 [Agent Skills](https://agentskills.io/specification) 开放标准（Cursor、Claude Code、Codex 等）。

## 预览

使用频率总览 — 加载次数、估算 skill token、已用/发现数、Task / 子 Agent 启动：

![Skill 使用频率总览](./docs/preview-overview.png)

按调用次数排序，含估算 token 与占比：

![按调用与 token 成本排序](./docs/preview-ranked-table.png)

流水线深度、高 token 加载、子 Agent 启动、库存健康度：

![流水线 / token / Task / 库存分解图](./docs/preview-breakdown.png)

## 安装

```bash
npx skills@latest add wei63w/skill-monitor
```

或将 `skills/skill-monitor` 复制到工具的 skills 目录：

| 工具 | 路径 |
|------|------|
| Cursor | `~/.cursor/skills/skill-monitor/` |
| Claude Code | `~/.claude/skills/skill-monitor/` |
| Codex | `~/.agents/skills/skill-monitor/` |

```bash
git clone https://github.com/wei63w/skill-monitor.git
cp -r skill-monitor/skills/skill-monitor ~/.cursor/skills/skill-monitor
```

捆绑 CLI 需要 **Node.js 18+** 在 `PATH` 中。

## 为什么用它？

Skill 库会悄悄膨胀。本 Skill 衡量的是 **skill 税**——技能被加载的频率，以及每次加载大致有多重。

没有使用数据时，高价值 skill 和死代码看起来一样。可后装到已有项目，可选从 Cursor 对话记录回填，再启用 Cursor Hook，让新的 `SKILL.md` 读取被计数。

这是一份能拿来裁剪、推广、补文档的使用报告，不是又一个没人看的 skill 目录。

## 价值与卖点

### 个人 / 团队

- **有据可删** — 0 次调用，或「体积大、调用少」的 skill，适合删除、合并，或拆成更小的渐进披露。
- **安装预算** — 用估算加载 token 给默认 skill 包设上限，避免新项目一上来就超重。
- **质量信号** — 调用很多任务仍翻车 → 改 skill 本身，而不是再堆新的。

### Skill 作者 / 开源维护者

- **体积 KPI** — 把 `File size` / 每次加载均 token 当成说明书膨胀的警报。
- **采用漏斗** — 安装量 vs 真实加载次数（开源 skill 的留存）。
- **版本对比** — 改写前后：均加载成本是否下降、调用是否上升。

### 工程 / 平台

- **上下文成本归因** — 粗分桶：贵对话里有多少可能来自 skill 正文 vs 代码 vs 工具输出。
- **路由策略** — 贵 skill 仅在明确匹配时加载；便宜 description 可常驻。
- **CI 门禁** — `SKILL.md` 估算 token 涨超阈值则失败（类似 bundle size budget）。
- **多 Agent 对比** — 同一仓库，谁更爱读大 skill。

### 产品 / 治理

- **内部技能目录叙事** — 用「调用 × 估 token」做 Agent 成本管理语言（不是发票）。
- **合规审计** — 哪些敏感领域 skill（安全、财务等）被读过、何时读。

### 相邻能力（同一套账本模式）

除 skill 外，本包已包含 **Rules / AGENTS.md 膨胀**（`bloat`）与 **Task / 子 Agent 启动成本**（`analyze-tasks`）。同一本地事件账本还可继续扩展为 MCP/工具调用账本。

### 它不擅长什么

强项是 **相对比较与治理**；弱项是 **绝对计费**。真正值钱的是：敢删 skill、敢设预算、敢在 CI 卡住越写越长的说明书——而不只是又一张排行榜。

## 局限（请先读）

各工具**没有**统一的 `onSkillUsed` API。采集是尽力而为：

| 路径 | 能抓到什么 |
|------|------------|
| Cursor `beforeReadFile` Hook | 读取 `**/SKILL.md` |
| `backfill` | Cursor `agent-transcripts` 里出现的 skill 路径 |
| `record` | 手动 / Agent 显式记账 |

未读盘、仅被注入上下文的 skill 无法记录。Codex / Claude 的自动采集弱于 Cursor Hook。

## 参考

- **[skill-monitor](./skills/skill-monitor/SKILL.md)** — 通过捆绑 CLI 完成安装、回填与频率分析。

### CLI

在已安装该 skill 的项目中（或复制到 `.cursor/skills/skill-monitor/` 后）：

```bash
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs setup --project . --hooks
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs backfill
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs backfill-tasks
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze --project . --write
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs bloat --project . --snapshot --write
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze-tasks --project . --write
```

| 命令 | 作用 |
|------|------|
| `setup [--hooks]` | 初始化 `data/`；合并读 skill + 子 Agent Hook |
| `record --path <SKILL.md>` | 记录一次 skill 使用 |
| `backfill` | 幂等扫描 Cursor transcripts（skill） |
| `backfill-tasks` | 幂等扫描 Task / 子 Agent 启动 |
| `list-skills` | 列举项目 + 用户 + 内置 skill |
| `analyze [--write]` | 频率表 + 估算 token |
| `bloat [--snapshot] [--write]` | Rules / AGENTS.md 体积、预算、可选历史 |
| `record-task --type <name>` | 记录一次子 Agent 启动 |
| `analyze-tasks [--write]` | 启动成本代理：次数 × 平均系统提示体积 |
| `reestimate` | 刷新已有事件的 skill token 估算 |
| `summary` | 打印 `data/summary.json` |

数据写在 skill 的 `data/` 目录（`events.jsonl`、`tasks.jsonl`、`context-snapshots.jsonl`、各类报告）。

**Skill token**：对每次 `SKILL.md` 用启发式估算（中日韩 ≈ 1，其余 ≈ 字符/4）。

**上下文膨胀**：测量常驻文件（`AGENTS.md`、`.cursor/rules/**`、`CLAUDE.md` 等），带软预算。

**子 Agent 成本** ≈ 启动次数 × 启动时 Rules+AGENTS 平均体积——用于比较编排税，**不是**厂商账单。

## 怎么工作

1. **Discover**：扫描项目与常见全局 skill 目录。
2. **Record**：Hook 读到 `SKILL.md`、回填或手动时写入事件。
3. **Aggregate**：汇总次数与会话到 `summary.json`。
4. **Analyze**：发现结果与计数合并，未使用的记为 `0`。

## 示例

```
> Set up skill-monitor in this project with hooks
> skill-monitor 回填历史并做频率分析
> Which skills are never used?
> Check AGENTS.md / rules bloat with skill-monitor
> skill-monitor 看子 Agent / Task 启动成本
> Analyze local skill usage with skill-monitor
```

## License

MIT — 见 [LICENSE](LICENSE)
