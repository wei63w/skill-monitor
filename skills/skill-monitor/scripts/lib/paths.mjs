import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the skill-monitor skill package (…/skill-monitor) */
export function skillRoot() {
  return path.resolve(__dirname, "..", "..");
}

/** Default data directory inside the skill package */
export function defaultDataDir() {
  return path.join(skillRoot(), "data");
}

/**
 * Resolve project root: --project flag, or walk up from cwd looking for .git / .cursor,
 * else cwd.
 */
export function resolveProjectRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  let dir = process.cwd();
  for (;;) {
    if (
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, ".cursor"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function homeDir() {
  return os.homedir();
}

export function cursorProjectsDir() {
  return path.join(homeDir(), ".cursor", "projects");
}

export function normalizePath(p) {
  if (!p) return "";
  return path.resolve(p).replace(/\\/g, "/");
}

/** Extract skill name from a SKILL.md path */
export function skillNameFromPath(filePath) {
  const n = normalizePath(filePath);
  const m = n.match(/\/([^/]+)\/SKILL\.md$/i);
  if (m) return m[1];
  return path.basename(path.dirname(filePath));
}

export function isSkillMdPath(filePath) {
  if (!filePath) return false;
  const base = path.basename(filePath);
  return base.toLowerCase() === "skill.md";
}
