# Skill Monitor

**English** | [中文](./README.zh-CN.md)

[![skills.sh](https://skills.sh/b/wei63w/skill-monitor)](https://skills.sh/wei63w/skill-monitor)

An Agent Skill for tracking which local skills you actually use — call counts, unused skills, and frequency reports stored in the project.

Agents load many skills. Few teams know which ones matter. Without a ledger, “we have 80 skills” becomes guesswork: keep everything, trust vibes, never prune.

Skill Monitor gives the agent a small, local pipeline: **record → backfill → analyze**. It discovers skills on disk, counts loads (best-effort), and prints a Markdown frequency table including **0-use** skills.

Compatible with the [Agent Skills](https://agentskills.io/specification) open standard (Cursor, Claude Code, Codex, and others).

## Install

```bash
npx skills@latest add wei63w/skill-monitor
```

Or copy `skills/skill-monitor` into your tool’s skills directory:

| Tool | Path |
|------|------|
| Cursor | `~/.cursor/skills/skill-monitor/` |
| Claude Code | `~/.claude/skills/skill-monitor/` |
| Codex | `~/.agents/skills/skill-monitor/` |

```bash
git clone https://github.com/wei63w/skill-monitor.git
cp -r skill-monitor/skills/skill-monitor ~/.cursor/skills/skill-monitor
```

Requires **Node.js 18+** on `PATH` for the bundled CLI.

## Why use it?

Skill libraries grow quietly.

Without usage data, high-value skills and dead weight look the same. Late-install into an existing project, optionally backfill from Cursor transcripts, then enable a Cursor hook so new `SKILL.md` reads are counted.

It’s a shortcut to a usage report you can act on — prune, promote, or document — not another unread folder of skills.

## Limits (read this)

There is **no** universal `onSkillUsed` API across tools. Capture is best-effort:

| Path | What it catches |
|------|-----------------|
| Cursor `beforeReadFile` hook | Reads of `**/SKILL.md` |
| `backfill` | Mentions of skill paths in Cursor `agent-transcripts` |
| `record` | Manual / agent-invoked logging |

Skills injected without reading `SKILL.md` are invisible. Codex/Claude auto-capture is weaker than Cursor’s hook.

## Reference

- **[skill-monitor](./skills/skill-monitor/SKILL.md)** — Setup, backfill, and frequency analysis via the bundled CLI.

### CLI

From a project that has the skill installed (or after copying it under `.cursor/skills/skill-monitor/`):

```bash
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs setup --project . --hooks
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs backfill
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze --project . --write
```

| Command | Purpose |
|---------|---------|
| `setup [--hooks]` | Init `data/`; optionally merge Cursor hook |
| `record --path <SKILL.md>` | Record one use |
| `backfill` | Idempotent scan of Cursor transcripts |
| `list-skills` | Enumerate project + user + builtin skills |
| `analyze [--write]` | Frequency table (includes 0-count skills) |
| `summary` | Print `data/summary.json` |

Data lives under the skill’s `data/` directory (`events.jsonl`, `summary.json`, optional `report.md`).

## How it works

1. **Discover** skills under project and common global skill roots.
2. **Record** events when a `SKILL.md` is read (hook), backfilled, or logged manually.
3. **Aggregate** counts and unique sessions into `summary.json`.
4. **Analyze** joins discovery with counts so unused skills show as `0`.

## Examples

```
> Set up skill-monitor in this project with hooks
> skill-monitor 回填历史并做频率分析
> Which skills are never used?
> skill 使用统计 / skill 频率分析
> Analyze local skill usage with skill-monitor
```

## License

MIT — see [LICENSE](LICENSE)
