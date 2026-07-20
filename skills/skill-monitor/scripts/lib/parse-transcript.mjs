import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  cursorProjectsDir,
  isSkillMdPath,
  normalizePath,
  skillNameFromPath,
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

  // Normalize slashes for matching
  const normalized = text.replace(/\\/g, "/");

  // Full Windows or Unix paths containing known skill roots
  const pathRe =
    /(?:[A-Za-z]:)?\/(?:[^/\s"'<>|]+\/)*(?:\.cursor\/skills(?:-cursor)?|\.agents\/skills|\.claude\/skills|\.codex\/skills|skills-cursor)\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})\/SKILL\.md/gi;

  let m;
  while ((m = pathRe.exec(normalized)) !== null) {
    const full = m[0];
    const skill = m[1];
    if (!isValidSkillName(skill)) continue;
    addFound(found, skill, normalizePath(full), transcriptPath);
  }

  // Relative mentions: .cursor/skills/foo/SKILL.md
  const relRe =
    /(?:\.cursor\/skills(?:-cursor)?|\.agents\/skills|\.claude\/skills|\.codex\/skills)\/([A-Za-z0-9][A-Za-z0-9._-]{0,63})\/SKILL\.md/gi;
  while ((m = relRe.exec(normalized)) !== null) {
    const skill = m[1];
    if (!isValidSkillName(skill)) continue;
    const full = m[0];
    addFound(found, skill, full, transcriptPath);
  }

  return [...found.values()];
}

function isValidSkillName(name) {
  if (!name || !VALID_SKILL_NAME.test(name)) return false;
  if (name === "..." || name.includes("...")) return false;
  if (name === "templates" || name === "scripts" || name === "data") return false;
  if (name === "skills" || name === "hooks" || name === "lib") return false;
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

/**
 * List transcript jsonl files under ~/.cursor/projects
 */
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

export function pathLooksLikeSkillMd(p) {
  return isSkillMdPath(p);
}

export { SKILL_ROOT_RE, isValidSkillName };
