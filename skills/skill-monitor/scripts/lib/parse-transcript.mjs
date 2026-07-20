import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  cursorProjectsDir,
  isSkillMdPath,
  normalizePath,
} from "./paths.mjs";

const VALID_SKILL_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** Paths that look like real skill installs */
const SKILL_ROOT_RE =
  /(?:^|\/)(?:\.cursor\/skills(?:-cursor)?|\.agents\/skills|\.claude\/skills|\.codex\/skills|skills-cursor)\/([^/]+)\/SKILL\.md$/i;

/**
 * Extract skill usage hints from transcript text.
 */
export function extractSkillsFromText(text, transcriptPath) {
  const found = new Map();
  if (!text) return [];

  const normalized = text.replace(/\\/g, "/");

  const pathRe =
    /(?:[A-Za-z]:)?\/(?:[^/\s"'<>|]+\/)*(?:\.cursor\/skills(?:-cursor)?|\.agents\/skills|\.claude\/skills|\.codex\/skills|skills-cursor)\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})\/SKILL\.md/gi;

  let m;
  while ((m = pathRe.exec(normalized)) !== null) {
    const full = m[0];
    const skill = m[1];
    if (!isValidSkillName(skill)) continue;
    addFound(found, skill, normalizePath(full), transcriptPath);
  }

  const relRe =
    /(?:\.cursor\/skills(?:-cursor)?|\.agents\/skills|\.claude\/skills|\.codex\/skills)\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})\/SKILL\.md/gi;
  while ((m = relRe.exec(normalized)) !== null) {
    const skill = m[1];
    if (!isValidSkillName(skill)) continue;
    addFound(found, skill, m[0], transcriptPath);
  }

  return [...found.values()];
}

/**
 * Extract Task / subagent starts from transcript text.
 */
export function extractTasksFromText(text, transcriptPath) {
  if (!text) return [];
  const found = new Map();
  const typeRe =
    /"subagent_type"\s*:\s*"([A-Za-z0-9_-]+)"|"subagentType"\s*:\s*"([A-Za-z0-9_-]+)"/gi;
  let m;
  let idx = 0;
  while ((m = typeRe.exec(text)) !== null) {
    const typ = m[1] || m[2];
    idx += 1;
    const key = hashKey(transcriptPath, typ, String(idx), String(m.index));
    if (!found.has(key)) {
      found.set(key, { type: typ, dedupeKey: key });
    }
  }

  const taskToolRe =
    /"tool(?:Name)?"\s*:\s*"Task"|toolName['"]?\s*[:=]\s*['"]Task['"]/gi;
  while ((m = taskToolRe.exec(text)) !== null) {
    const window = text.slice(m.index, m.index + 400);
    const tm = window.match(
      /subagent_type["']?\s*[:=]\s*["']([A-Za-z0-9_-]+)/i
    );
    const typ = tm ? tm[1] : "Task";
    const key = hashKey(transcriptPath, typ, "tool", String(m.index));
    if (!found.has(key)) {
      found.set(key, { type: typ, dedupeKey: key });
    }
  }

  return [...found.values()];
}

function isValidSkillName(name) {
  if (!name || !VALID_SKILL_NAME.test(name)) return false;
  if (name === "..." || name.includes("...")) return false;
  if (["templates", "scripts", "data", "skills", "hooks", "lib"].includes(name)) {
    return false;
  }
  return true;
}

function addFound(found, skill, fullPath, transcriptPath) {
  const key = `${skill}|${normalizePath(fullPath)}`;
  if (found.has(key)) return;
  found.set(key, {
    skill,
    path: normalizePath(fullPath),
    dedupeKey: hashKey(transcriptPath, skill, normalizePath(fullPath)),
  });
}

function hashKey(...parts) {
  return crypto
    .createHash("sha1")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 16);
}

export function listCursorTranscripts(options = {}) {
  const root = cursorProjectsDir();
  const filter = options.projectFilter
    ? String(options.projectFilter).toLowerCase()
    : null;
  const out = [];
  if (!fs.existsSync(root)) return out;

  let projects;
  try {
    projects = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    if (filter && !proj.name.toLowerCase().includes(filter)) continue;
    const transcriptsDir = path.join(root, proj.name, "agent-transcripts");
    if (!fs.existsSync(transcriptsDir)) continue;
    collectJsonl(transcriptsDir, out);
  }
  return out;
}

function collectJsonl(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectJsonl(full, out);
    } else if (ent.isFile() && ent.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
}

export function parseTranscriptFile(transcriptPath) {
  let text;
  try {
    text = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return [];
  }
  const skills = extractSkillsFromText(text, transcriptPath);
  const mtime = fs.statSync(transcriptPath).mtime.toISOString();
  return skills.map((s) => ({
    ts: mtime,
    skill: s.skill,
    path: s.path,
    source: "backfill",
    sessionId: path.basename(transcriptPath, ".jsonl"),
    tool: "cursor",
    dedupeKey: s.dedupeKey,
  }));
}

export function parseTranscriptTasks(transcriptPath) {
  let text;
  try {
    text = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return [];
  }
  const tasks = extractTasksFromText(text, transcriptPath);
  const mtime = fs.statSync(transcriptPath).mtime.toISOString();
  return tasks.map((t) => ({
    ts: mtime,
    type: t.type,
    source: "backfill",
    sessionId: path.basename(transcriptPath, ".jsonl"),
    tool: "cursor",
    dedupeKey: t.dedupeKey,
  }));
}

export function pathLooksLikeSkillMd(p) {
  return isSkillMdPath(p);
}

export { SKILL_ROOT_RE, isValidSkillName };
