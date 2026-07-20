# Launch kit — get skill-monitor seen

skills.sh ranks by **install telemetry** (`npx skills add …`). No submission form. Drive installs → appear on the directory.

## 0. Repo page (already set)

- Homepage → https://skills.sh/wei63w/skill-monitor  
- Topics: `agent-skills`, `cursor`, `claude-code`, `codex`, `skills`, …  
- Install line in README: `npx skills@latest add wei63w/skill-monitor`

## 1. Seed installs (today, 15 min)

On every machine / teammate / CI you control:

```bash
npx skills@latest add wei63w/skill-monitor -g -y
```

Ask 5–10 friends in Cursor/Claude circles to run the same once. First installs unlock the skills.sh page.

## 2. Post copy (paste anywhere)

### Short (X / 即刻 / 朋友圈)

**EN**

> Your agent has 80 skills. You have no idea which ones matter.
>
> skill-monitor: usage counts + rough SKILL.md tokens + Rules/AGENTS.md bloat + Task/sub-agent startup cost.
>
> `npx skills add wei63w/skill-monitor`
> https://github.com/wei63w/skill-monitor

**中文**

> Agent 装了 80 个 skill，你却不知道哪些在烧 token。
>
> skill-monitor：调用次数 + SKILL.md 粗估 token + Rules/AGENTS 膨胀 + 子 Agent 启动成本。
>
> `npx skills add wei63w/skill-monitor`
> https://github.com/wei63w/skill-monitor

### Longer (Reddit / Discord / V2EX / 即刻长文)

Hook → problem → one install → three screenshots from README → CTA.

Communities that convert:

| Where | Angle |
|-------|--------|
| Cursor Forum / Discord | “which skills are unused / expensive” |
| Claude Code Discord | same + AGENTS.md / CLAUDE.md bloat |
| r/LocalLLaMA, r/ClaudeAI, r/cursor | tool post with screenshots |
| V2EX / 即刻 / 小红书程序员 | 中文「skill 税 / token」 |
| Twitter/X #AgentSkills #Cursor | pin the install command |

## 3. Cross-link (high leverage)

- In **grader-skill** README “Related” → link skill-monitor (you already have audience there).
- Reply under viral “too many skills / context too long” posts with the one-liner install.
- Add skill to any personal site / Notion “agent stack”.

## 4. Content that spreads

1. One thread: before/after prune (delete 20 unused skills).  
2. One GIF: `analyze` → table → delete decision.  
3. Short demo video (30–60s) → YouTube Shorts / B站 / X.

## 5. Don’t waste time on

- Waiting for skills.sh “approval” (there isn’t one).  
- Perfect landing page before first 50 installs.  
- SEO essays without the install command in the first screen.

## Measure

- GitHub: Traffic / Stars / Clones  
- skills.sh page install count (after first installs appear)  
- Issues titled “how I use this” = real adoption
