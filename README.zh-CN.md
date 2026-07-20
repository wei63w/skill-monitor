# Skill Monitor

[English](./README.md) | **中文**

[![skills.sh](https://skills.sh/b/wei63w/skill-monitor)](https://skills.sh/wei63w/skill-monitor)

用于统计本地 Agent Skill 实际使用情况的 Skill：调用次数、从未使用的 skill、项目内频率报告。

Agent 会加载很多 skill，团队却很少知道哪些真正有用。没有账本时，「我们有 80 个 skill」只能靠感觉：全留着、凭印象、从不清理。

Skill Monitor 给 Agent 一条本地流水线：**record → backfill → analyze**。扫描磁盘上的 skill、尽力计数加载次数，并输出含 **0 次使用** 项的 Markdown 频率表。

兼容 [Agent Skills](https://agentskills.io/specification) 开放标准（Cursor、Claude Code、Codex 等）。

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

Skill 库会悄悄膨胀。

没有使用数据时，高价值 skill 和死代码看起来一样。可后装到已有项目，可选从 Cursor 对话记录回填，再启用 Cursor Hook，让新的 `SKILL.md` 读取被计数。

这是一份能拿来裁剪、推广、补文档的使用报告，不是又一个没人看的 skill 目录。

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
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze --project . --write
```

| 命令 | 作用 |
|------|------|
| `setup [--hooks]` | 初始化 `data/`；可选合并 Cursor Hook |
| `record --path <SKILL.md>` | 记录一次使用 |
| `backfill` | 幂等扫描 Cursor transcripts |
| `list-skills` | 列举项目 + 用户 + 内置 skill |
| `analyze [--write]` | 频率表（含 0 次） |
| `summary` | 打印 `data/summary.json` |

数据写在 skill 的 `data/` 目录（`events.jsonl`、`summary.json`、可选 `report.md`）。

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
> skill 使用统计 / skill 频率分析
> Analyze local skill usage with skill-monitor
```

## License

MIT — 见 [LICENSE](LICENSE)
