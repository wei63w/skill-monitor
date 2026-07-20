import fs from "node:fs";
import path from "node:path";
import { defaultDataDir, normalizePath, skillNameFromPath } from "./paths.mjs";
import { estimateTokensFromFile } from "./tokens.mjs";

export function ensureDataDir(dataDir = defaultDataDir()) {
  fs.mkdirSync(dataDir, { recursive: true });
  const eventsPath = path.join(dataDir, "events.jsonl");
  const summaryPath = path.join(dataDir, "summary.json");
  if (!fs.existsSync(eventsPath)) fs.writeFileSync(eventsPath, "", "utf8");
  if (!fs.existsSync(summaryPath)) {
    writeSummary(dataDir, emptySummary());
  }
  return dataDir;
}

export function emptySummary() {
  return {
    skills: {},
    updatedAt: new Date().toISOString(),
    totalEvents: 0,
    totalEstTokens: 0,
    tokenNote:
      "estTokens are rough (CJK≈1, other≈chars/4), not provider billing tokens",
  };
}

export function eventsPath(dataDir = defaultDataDir()) {
  return path.join(dataDir, "events.jsonl");
}

export function summaryPath(dataDir = defaultDataDir()) {
  return path.join(dataDir, "summary.json");
}

export function backfillCursorPath(dataDir = defaultDataDir()) {
  return path.join(dataDir, "backfill-cursor.json");
}

export function readEvents(dataDir = defaultDataDir()) {
  ensureDataDir(dataDir);
  const raw = fs.readFileSync(eventsPath(dataDir), "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip corrupt lines
    }
  }
  return events;
}

export function writeSummary(dataDir, summary) {
  fs.writeFileSync(
    summaryPath(dataDir),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8"
  );
}

export function readSummary(dataDir = defaultDataDir()) {
  ensureDataDir(dataDir);
  try {
    return JSON.parse(fs.readFileSync(summaryPath(dataDir), "utf8"));
  } catch {
    return emptySummary();
  }
}

function resolveEventTokens(ev) {
  if (typeof ev.estTokens === "number" && ev.estTokens >= 0) {
    return ev.estTokens;
  }
  if (ev.path) {
    const n = estimateTokensFromFile(ev.path);
    if (n > 0) return n;
  }
  return 0;
}

export function rebuildSummary(dataDir = defaultDataDir()) {
  const events = readEvents(dataDir);
  const summary = emptySummary();
  summary.totalEvents = events.length;
  let totalEstTokens = 0;
  for (const ev of events) {
    const name = ev.skill || "unknown";
    if (!summary.skills[name]) {
      summary.skills[name] = {
        count: 0,
        estTokens: 0,
        avgEstTokens: 0,
        sessionIds: {},
        lastUsed: null,
        paths: [],
        sources: {},
      };
    }
    const s = summary.skills[name];
    const tok = resolveEventTokens(ev);
    s.count += 1;
    s.estTokens += tok;
    totalEstTokens += tok;
    if (ev.sessionId) s.sessionIds[ev.sessionId] = true;
    if (ev.ts && (!s.lastUsed || ev.ts > s.lastUsed)) s.lastUsed = ev.ts;
    const p = normalizePath(ev.path || "");
    if (p && !s.paths.includes(p)) s.paths.push(p);
    const src = ev.source || "unknown";
    s.sources[src] = (s.sources[src] || 0) + 1;
  }
  for (const name of Object.keys(summary.skills)) {
    const s = summary.skills[name];
    s.uniqueSessions = Object.keys(s.sessionIds).length;
    s.avgEstTokens =
      s.count > 0 ? Math.round(s.estTokens / s.count) : 0;
    delete s.sessionIds;
  }
  summary.totalEstTokens = totalEstTokens;
  summary.updatedAt = new Date().toISOString();
  writeSummary(dataDir, summary);
  return summary;
}

/**
 * Rewrite events.jsonl filling missing estTokens from current SKILL.md files.
 */
export function reestimateEvents(dataDir = defaultDataDir()) {
  ensureDataDir(dataDir);
  const events = readEvents(dataDir);
  let updated = 0;
  const lines = events.map((ev) => {
    const next = { ...ev };
    const fromFile = next.path ? estimateTokensFromFile(next.path) : 0;
    if (fromFile > 0 && next.estTokens !== fromFile) {
      next.estTokens = fromFile;
      updated += 1;
    } else if (
      (next.estTokens == null || next.estTokens === 0) &&
      fromFile > 0
    ) {
      next.estTokens = fromFile;
      updated += 1;
    }
    return JSON.stringify(next);
  });
  fs.writeFileSync(eventsPath(dataDir), lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
  const summary = rebuildSummary(dataDir);
  return { updated, total: events.length, summary };
}

/**
 * Append one event. Returns the event or null if skipped as duplicate (when dedupeKey set and exists).
 */
export function recordEvent(partial, dataDir = defaultDataDir(), options = {}) {
  ensureDataDir(dataDir);
  const filePath = partial.path || "";
  const skill =
    partial.skill ||
    (filePath ? skillNameFromPath(filePath) : "unknown");
  let estTokens = partial.estTokens;
  if (estTokens == null || estTokens === "") {
    estTokens = filePath ? estimateTokensFromFile(filePath) : 0;
  } else {
    estTokens = Number(estTokens) || 0;
  }
  const event = {
    ts: partial.ts || new Date().toISOString(),
    skill,
    path: normalizePath(filePath),
    source: partial.source || "manual",
    sessionId: partial.sessionId || null,
    tool: partial.tool || "cursor",
    dedupeKey: partial.dedupeKey || null,
    estTokens,
  };

  if (options.dedupe && event.dedupeKey) {
    const existing = readEvents(dataDir);
    if (existing.some((e) => e.dedupeKey === event.dedupeKey)) {
      return { event: null, skipped: true };
    }
  }

  fs.appendFileSync(eventsPath(dataDir), JSON.stringify(event) + "\n", "utf8");
  rebuildSummary(dataDir);
  return { event, skipped: false };
}

export function readBackfillCursor(dataDir = defaultDataDir()) {
  const p = backfillCursorPath(dataDir);
  if (!fs.existsSync(p)) return { processed: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { processed: {} };
  }
}

export function writeBackfillCursor(dataDir, cursor) {
  ensureDataDir(dataDir);
  fs.writeFileSync(
    backfillCursorPath(dataDir),
    JSON.stringify(cursor, null, 2) + "\n",
    "utf8"
  );
}
