import fs from "node:fs";
import path from "node:path";
import { homeDir, normalizePath, resolveProjectRoot } from "./paths.mjs";

function walkForSkillMd(root, maxDepth = 6, depth = 0, out = []) {
  if (!root || depth > maxDepth || !fs.existsSync(root)) return out;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") && ent.name !== ".cursor" && ent.name !== ".agents" && ent.name !== ".claude" && ent.name !== ".codex") {
      // allow known skill roots; skip other dotdirs when walking deeper from home-ish
    }
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const full = path.join(root, ent.name);
    if (ent.isFile() && ent.name.toLowerCase() === "skill.md") {
      out.push(full);
      continue;
    }
    if (ent.isDirectory()) {
      // Prefer shallow skill dirs: <root>/<skill>/SKILL.md
      const skillMd = path.join(full, "SKILL.md");
      if (fs.existsSync(skillMd)) {
        out.push(skillMd);
        continue;
      }
      walkForSkillMd(full, maxDepth, depth + 1, out);
    }
  }
  return out;
}

function scopeLabel(absPath, projectRoot) {
  const n = normalizePath(absPath);
  const home = normalizePath(homeDir());
  const proj = normalizePath(projectRoot);
  if (n.includes("/.cursor/skills-cursor/")) return "builtin";
  if (proj && n.startsWith(proj + "/")) return "project";
  if (n.startsWith(home + "/.cursor/skills/") || n.startsWith(home + "/.claude/skills/") || n.startsWith(home + "/.codex/skills/") || n.startsWith(home + "/.agents/skills/")) {
    return "user";
  }
  if (n.includes("/.cursor/skills/") || n.includes("/.agents/skills/") || n.includes("/.claude/skills/") || n.includes("/.codex/skills/")) {
    return "project";
  }
  return "other";
}

/**
 * Discover all local skills under project + common global locations.
 */
export function discoverSkills(options = {}) {
  const projectRoot = resolveProjectRoot(options.project);
  const home = homeDir();
  const roots = [
    path.join(projectRoot, ".cursor", "skills"),
    path.join(projectRoot, ".agents", "skills"),
    path.join(projectRoot, ".claude", "skills"),
    path.join(projectRoot, ".codex", "skills"),
    path.join(home, ".cursor", "skills"),
    path.join(home, ".cursor", "skills-cursor"),
    path.join(home, ".claude", "skills"),
    path.join(home, ".codex", "skills"),
    path.join(home, ".agents", "skills"),
  ];

  const seen = new Map(); // name+path -> entry
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    // Direct children that are skill dirs
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith(".") && ent.name !== ".system") continue;
      const skillMd = path.join(root, ent.name, "SKILL.md");
      // Codex .system and nested
      if (fs.existsSync(skillMd)) {
        addSkill(seen, ent.name, skillMd, scopeLabel(skillMd, projectRoot), root);
        continue;
      }
      // Nested one level (e.g. .system/foo/SKILL.md)
      const nested = path.join(root, ent.name);
      try {
        for (const sub of fs.readdirSync(nested, { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          const nestedMd = path.join(nested, sub.name, "SKILL.md");
          if (fs.existsSync(nestedMd)) {
            addSkill(seen, sub.name, nestedMd, scopeLabel(nestedMd, projectRoot), root);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    projectRoot,
    skills: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function addSkill(seen, name, skillMd, scope, root) {
  const key = normalizePath(skillMd);
  if (seen.has(key)) return;
  let description = "";
  try {
    const raw = fs.readFileSync(skillMd, "utf8");
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm) {
      const dm = fm[1].match(/^description:\s*(?:>-?\s*)?(.*)$/m);
      if (dm) {
        description = dm[1].replace(/^["']|["']$/g, "").trim();
        if (description === "|" || description === ">") {
          const block = fm[1].match(/description:\s*[|>]-?\s*\n((?:\s{2,}.+\n?)+)/);
          if (block) {
            description = block[1]
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .join(" ")
              .slice(0, 200);
          }
        }
      }
      const nm = fm[1].match(/^name:\s*(.+)$/m);
      if (nm) name = nm[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // ignore
  }
  seen.set(key, {
    name,
    path: key,
    scope,
    root: normalizePath(root),
    description: description.slice(0, 200),
  });
}

export function listSkillsMarkdown(discovered) {
  const lines = [
    `# Skills discovered (${discovered.skills.length})`,
    "",
    `Project root: \`${discovered.projectRoot}\``,
    "",
    "| Name | Scope | Path |",
    "| --- | --- | --- |",
  ];
  for (const s of discovered.skills) {
    lines.push(`| ${s.name} | ${s.scope} | \`${s.path}\` |`);
  }
  return lines.join("\n") + "\n";
}
