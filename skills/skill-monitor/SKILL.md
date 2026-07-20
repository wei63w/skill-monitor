---
name: skill-monitor
description: >-
  Monitor and analyze how often local Agent Skills are used, including rough
  token estimates for SKILL.md loads. Use whenever the user asks about skill
  usage, skill frequency, skill token cost, which skills are unused, skill call
  counts, backfilling skill history from transcripts, or setting up skill usage
  tracking in a project. Also use when the user says skill 监控, skill 统计,
  skill 频率分析, skill token, or 回填 skill 使用记录.
---

# Skill Monitor

Track skill usage in the **current project** with local files under this skill's `data/` directory. Capture is best-effort (not 100% across every tool).

## Quick setup (late-install into a project)

1. Ensure this skill lives at `.cursor/skills/skill-monitor/` in the project (or copy it there).
2. Run setup (initializes `data/`; add `--hooks` for Cursor auto-capture on `SKILL.md` reads):

```bash
node .cursor/skills/skill-monitor/scripts/cli.mjs setup --project . --hooks
```

3. Optional history backfill from Cursor agent transcripts:

```bash
node .cursor/skills/skill-monitor/scripts/cli.mjs backfill
```

4. Frequency report (lists **all** discovered skills, including 0 uses):

```bash
node .cursor/skills/skill-monitor/scripts/cli.mjs analyze --project . --write
```

## Commands

Run from the project root (or pass `--project` / `--data`):

| Command | Purpose |
| --- | --- |
| `setup [--hooks]` | Create `data/`; optionally merge Cursor `beforeReadFile` hook |
| `record --path <SKILL.md>` | Manually record one use |
| `backfill` | Scan `~/.cursor/projects/*/agent-transcripts` (idempotent) |
| `list-skills` | Enumerate project + user + builtin skills |
| `analyze [--write]` | Usage frequency + estimated token table → stdout / `data/report.md` |
| `reestimate` | Refresh `estTokens` on existing events from current SKILL.md files |
| `summary` | Print aggregated `data/summary.json` |

## Data layout

- `data/events.jsonl` — one JSON event per line
- `data/summary.json` — aggregated counts + `estTokens`
- `data/backfill-cursor.json` — backfill idempotency cursor
- `data/report.md` — last written analyze report (if `--write`)

Event shape:

```json
{"ts":"...","skill":"name","path":".../SKILL.md","source":"hook|backfill|manual","sessionId":null,"tool":"cursor","estTokens":1200}
```

`estTokens` is a rough size of the loaded `SKILL.md` (CJK ≈ 1 token/char, other ≈ chars/4). It is **not** full-chat or provider billing tokens.
## Agent workflow

When the user asks for skill stats:

1. Prefer running `analyze --write` and show the Markdown table.
2. If data looks empty and they want history, run `backfill` then `analyze` again.
3. If hooks are not installed and they want ongoing capture, run `setup --hooks`.
4. Mention limitations briefly: Cursor Hook catches `SKILL.md` reads; other tools may need manual `record` or transcript backfill; injected skills with no file read are invisible.

Do **not** claim perfect per-conversation coverage on Codex or every CLI.

## Manual record (fallback)

```bash
node .cursor/skills/skill-monitor/scripts/cli.mjs record --path "C:/path/to/some-skill/SKILL.md" --source manual
```
