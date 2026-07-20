import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "./paths.mjs";
import { systemPromptVolume } from "./context-bloat.mjs";

export function tasksPath(dataDir) {
  return path.join(dataDir, "tasks.jsonl");
}

export function ensureTasksFile(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const p = tasksPath(dataDir);
  if (!fs.existsSync(p)) fs.writeFileSync(p, "", "utf8");
  return p;
}

export function readTasks(dataDir) {
  ensureTasksFile(dataDir);
  const raw = fs.readFileSync(tasksPath(dataDir), "utf8");
  const out = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Record one sub-agent / Task start.
 * Cost proxy: systemPromptTokens (Rules+AGENTS volume at start).
 */
export function recordTask(partial, dataDir, projectRoot) {
  ensureTasksFile(dataDir);
  let systemPromptTokens = partial.systemPromptTokens;
  let promptBreakdown = partial.promptBreakdown || null;
  if (systemPromptTokens == null && projectRoot) {
    const vol = systemPromptVolume(projectRoot);
    systemPromptTokens = vol.estTokens;
    promptBreakdown = vol.byKind;
  }
  const event = {
    ts: partial.ts || new Date().toISOString(),
    type: partial.type || "unknown",
    source: partial.source || "manual",
    sessionId: partial.sessionId || null,
    tool: partial.tool || "cursor",
    systemPromptTokens: Number(systemPromptTokens) || 0,
    promptBreakdown,
    dedupeKey: partial.dedupeKey || null,
    note: partial.note || null,
  };

  if (event.dedupeKey) {
    const existing = readTasks(dataDir);
    if (existing.some((e) => e.dedupeKey === event.dedupeKey)) {
      return { event: null, skipped: true };
    }
  }

  fs.appendFileSync(tasksPath(dataDir), JSON.stringify(event) + "\n", "utf8");
  return { event, skipped: false };
}

export function summarizeTasks(dataDir) {
  const tasks = readTasks(dataDir);
  const byType = {};
  let totalStarts = 0;
  let totalSystemPromptTokens = 0;
  for (const t of tasks) {
    totalStarts += 1;
    const tok = t.systemPromptTokens || 0;
    totalSystemPromptTokens += tok;
    const typ = t.type || "unknown";
    if (!byType[typ]) {
      byType[typ] = { count: 0, systemPromptTokens: 0 };
    }
    byType[typ].count += 1;
    byType[typ].systemPromptTokens += tok;
  }
  const avg =
    totalStarts > 0 ? Math.round(totalSystemPromptTokens / totalStarts) : 0;
  return {
    totalStarts,
    totalSystemPromptTokens,
    avgSystemPromptTokens: avg,
    /** Startup cost proxy: Task count × avg system prompt volume */
    startupCostProxy: totalStarts * avg,
    byType,
    updatedAt: new Date().toISOString(),
  };
}

export function formatTasksReport(summary, projectRoot) {
  const lines = [
    `# Sub-agent / Task startup cost`,
    "",
    `- Project: \`${normalizePath(projectRoot || "")}\``,
    `- Task / sub-agent starts: ${summary.totalStarts}`,
    `- Sum of system-prompt volume at start: ${summary.totalSystemPromptTokens} est. tokens`,
    `- Avg system-prompt volume / start: ${summary.avgSystemPromptTokens}`,
    `- Startup cost proxy (starts × avg volume): ${summary.startupCostProxy}`,
    `- Report generated: ${summary.updatedAt}`,
    "",
    `| Type | Starts | Sum prompt tokens | Avg / start |`,
    `| --- | ---: | ---: | ---: |`,
  ];

  const rows = Object.entries(summary.byType).sort(
    (a, b) => b[1].count - a[1].count
  );
  if (!rows.length) {
    lines.push(`| — | 0 | 0 | 0 |`);
  } else {
    for (const [typ, s] of rows) {
      const avg = s.count ? Math.round(s.systemPromptTokens / s.count) : 0;
      lines.push(
        `| ${typ} | ${s.count} | ${s.systemPromptTokens} | ${avg} |`
      );
    }
  }

  lines.push("");
  lines.push(
    `_System prompt volume ~= project AGENTS.md + .cursor/rules (+ related). Proxy cost = starts x avg volume - not provider billing._`
  );
  lines.push(
    `_Capture: Cursor subagentStart / Task hook, record-task, or backfill-tasks from transcripts._`
  );
  return lines.join("\n") + "\n";
}
