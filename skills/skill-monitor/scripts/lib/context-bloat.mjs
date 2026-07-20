import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "./paths.mjs";
import { estimateTokensFromFile } from "./tokens.mjs";

const ROOT_FILES = [
  "AGENTS.md",
  "AGENT.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  ".cursorrules",
  ".cursorignore",
  "GEMINI.md",
  "CODEX.md",
];

/**
 * Discover Rules / AGENTS.md / related always-on context files in a project.
 */
export function discoverContextFiles(projectRoot) {
  const root = path.resolve(projectRoot);
  const files = [];

  for (const name of ROOT_FILES) {
    const full = path.join(root, name);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      files.push({
        kind: kindForName(name),
        name,
        path: normalizePath(full),
        relative: name,
      });
    }
  }

  const rulesDir = path.join(root, ".cursor", "rules");
  if (fs.existsSync(rulesDir) && fs.statSync(rulesDir).isDirectory()) {
    walkRules(rulesDir, root, files);
  }

  const rulesFile = path.join(root, ".cursor", "rules.md");
  if (fs.existsSync(rulesFile) && fs.statSync(rulesFile).isFile()) {
    files.push({
      kind: "rules",
      name: ".cursor/rules.md",
      path: normalizePath(rulesFile),
      relative: ".cursor/rules.md",
    });
  }

  // User-level Cursor rules (optional, marked scope=user)
  const homeRules = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".cursor",
    "rules"
  );
  if (homeRules && fs.existsSync(homeRules)) {
    try {
      for (const ent of fs.readdirSync(homeRules, { withFileTypes: true })) {
        if (!ent.isFile()) continue;
        if (!/\.(md|mdc|txt)$/i.test(ent.name)) continue;
        const full = path.join(homeRules, ent.name);
        files.push({
          kind: "user-rules",
          name: `~/.cursor/rules/${ent.name}`,
          path: normalizePath(full),
          relative: `user:.cursor/rules/${ent.name}`,
          scope: "user",
        });
      }
    } catch {
      // ignore
    }
  }

  return files;
}

function kindForName(name) {
  const n = name.toLowerCase();
  if (n.startsWith("agents") || n === "agent.md") return "agents";
  if (n.startsWith("claude")) return "claude";
  if (n.includes("cursor")) return "cursor";
  return "other";
}

function walkRules(dir, projectRoot, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkRules(full, projectRoot, out);
      continue;
    }
    if (!/\.(md|mdc|txt)$/i.test(ent.name)) continue;
    const rel = normalizePath(path.relative(projectRoot, full));
    out.push({
      kind: "rules",
      name: rel,
      path: normalizePath(full),
      relative: rel,
      scope: "project",
    });
  }
}

export function measureContextFiles(projectRoot) {
  const files = discoverContextFiles(projectRoot);
  const measured = files.map((f) => {
    let bytes = 0;
    try {
      bytes = fs.statSync(f.path).size;
    } catch {
      bytes = 0;
    }
    const estTokens = estimateTokensFromFile(f.path);
    return {
      ...f,
      scope: f.scope || "project",
      bytes,
      estTokens,
    };
  });

  measured.sort((a, b) => b.estTokens - a.estTokens || a.name.localeCompare(b.name));

  const byKind = {};
  let totalTokens = 0;
  let totalBytes = 0;
  for (const m of measured) {
    totalTokens += m.estTokens;
    totalBytes += m.bytes;
    byKind[m.kind] = (byKind[m.kind] || 0) + m.estTokens;
  }

  return {
    projectRoot: normalizePath(projectRoot),
    ts: new Date().toISOString(),
    files: measured,
    totalTokens,
    totalBytes,
    byKind,
  };
}

/** Default soft budgets (est. tokens). */
export const DEFAULT_BLOAT_BUDGETS = {
  perFile: 2000,
  total: 8000,
  agents: 3000,
  rules: 5000,
};

export function evaluateBloat(snapshot, budgets = DEFAULT_BLOAT_BUDGETS) {
  const warnings = [];
  if (snapshot.totalTokens > budgets.total) {
    warnings.push({
      level: "high",
      code: "total",
      message: `Total context files ${snapshot.totalTokens} est. tokens > budget ${budgets.total}`,
    });
  }
  const agentsTok = snapshot.byKind.agents || 0;
  if (agentsTok > budgets.agents) {
    warnings.push({
      level: "medium",
      code: "agents",
      message: `AGENTS* files ${agentsTok} est. tokens > budget ${budgets.agents}`,
    });
  }
  const rulesTok = (snapshot.byKind.rules || 0) + (snapshot.byKind["user-rules"] || 0);
  if (rulesTok > budgets.rules) {
    warnings.push({
      level: "medium",
      code: "rules",
      message: `Rules files ${rulesTok} est. tokens > budget ${budgets.rules}`,
    });
  }
  for (const f of snapshot.files) {
    if (f.estTokens > budgets.perFile) {
      warnings.push({
        level: "medium",
        code: "perFile",
        message: `${f.name}: ${f.estTokens} est. tokens > per-file budget ${budgets.perFile}`,
        path: f.path,
      });
    }
  }
  return warnings;
}

/**
 * Project "system prompt volume" proxy: sum of project-scoped context files
 * (excludes user-global rules by default for sub-agent cost).
 */
export function systemPromptVolume(projectRoot, options = {}) {
  const snap = measureContextFiles(projectRoot);
  const includeUser = Boolean(options.includeUserRules);
  const files = snap.files.filter(
    (f) => includeUser || f.scope !== "user"
  );
  const tokens = files.reduce((n, f) => n + f.estTokens, 0);
  return {
    estTokens: tokens,
    fileCount: files.length,
    byKind: files.reduce((acc, f) => {
      acc[f.kind] = (acc[f.kind] || 0) + f.estTokens;
      return acc;
    }, {}),
    snapshot: { ...snap, files, totalTokens: tokens },
  };
}

export function appendContextSnapshot(dataDir, snapshot) {
  const p = path.join(dataDir, "context-snapshots.jsonl");
  const line = {
    ts: snapshot.ts,
    projectRoot: snapshot.projectRoot,
    totalTokens: snapshot.totalTokens,
    totalBytes: snapshot.totalBytes,
    byKind: snapshot.byKind,
    files: snapshot.files.map((f) => ({
      name: f.name,
      kind: f.kind,
      scope: f.scope,
      estTokens: f.estTokens,
      bytes: f.bytes,
    })),
  };
  fs.appendFileSync(p, JSON.stringify(line) + "\n", "utf8");
  return p;
}

export function readContextSnapshots(dataDir) {
  const p = path.join(dataDir, "context-snapshots.jsonl");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function formatBloatReport(snapshot, warnings, previous) {
  const lines = [
    `# Context bloat (Rules / AGENTS.md)`,
    "",
    `- Project: \`${snapshot.projectRoot}\``,
    `- Measured: ${snapshot.ts}`,
    `- Files: ${snapshot.files.length}`,
    `- Total est. tokens: ${snapshot.totalTokens}`,
    `- Total bytes: ${snapshot.totalBytes}`,
    "",
  ];

  if (previous) {
    const delta = snapshot.totalTokens - (previous.totalTokens || 0);
    const sign = delta > 0 ? "+" : "";
    lines.push(
      `- vs previous snapshot (${previous.ts}): ${sign}${delta} est. tokens`
    );
    lines.push("");
  }

  lines.push(`| File | Kind | Scope | Est. tokens | Bytes |`);
  lines.push(`| --- | --- | --- | ---: | ---: |`);
  for (const f of snapshot.files) {
    lines.push(
      `| \`${f.name}\` | ${f.kind} | ${f.scope} | ${f.estTokens} | ${f.bytes} |`
    );
  }

  if (Object.keys(snapshot.byKind).length) {
    lines.push("");
    lines.push(`### By kind`);
    lines.push("");
    lines.push(`| Kind | Est. tokens |`);
    lines.push(`| --- | ---: |`);
    for (const [k, v] of Object.entries(snapshot.byKind).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${k} | ${v} |`);
    }
  }

  lines.push("");
  lines.push(`### Budget warnings`);
  lines.push("");
  if (!warnings.length) {
    lines.push(`_None - under default soft budgets._`);
  } else {
    for (const w of warnings) {
      lines.push(`- **${w.level}** \`${w.code}\`: ${w.message}`);
    }
  }

  lines.push("");
  lines.push(
    `_Est. tokens use the same heuristic as skill loads (CJK~1, other~chars/4). Always-on context is a lower bound on every turn / sub-agent start._`
  );
  return lines.join("\n") + "\n";
}
