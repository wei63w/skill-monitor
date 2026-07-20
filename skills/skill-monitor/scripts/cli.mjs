#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills, listSkillsMarkdown } from "./lib/discover.mjs";
import {
  listCursorTranscripts,
  parseTranscriptFile,
} from "./lib/parse-transcript.mjs";
import {
  defaultDataDir,
  normalizePath,
  resolveProjectRoot,
  skillNameFromPath,
  skillRoot,
  isSkillMdPath,
} from "./lib/paths.mjs";
import {
  ensureDataDir,
  readBackfillCursor,
  readEvents,
  readSummary,
  rebuildSummary,
  recordEvent,
  writeBackfillCursor,
} from "./lib/store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printHelp() {
  console.log(`skill-monitor CLI

Usage:
  node cli.mjs <command> [options]

Commands:
  setup [--project <dir>] [--hooks]     Init data dir; optional merge Cursor hooks
  record --path <SKILL.md> [options]    Record one skill use
  list-skills [--project <dir>]         List discovered local skills
  analyze [--project <dir>] [--write]   Frequency report (includes 0-count skills)
  backfill [--project-filter <s>]       Backfill from Cursor agent-transcripts
  summary                               Print summary.json

Global options:
  --data <dir>     Override data directory (default: skill package data/)
  --help           Show help

Record options:
  --skill <name>   Override skill name
  --source <src>   hook|backfill|manual (default: manual)
  --session <id>   Session id
  --tool <name>    Tool name (default: cursor)
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--hooks") args.hooks = true;
    else if (a === "--write") args.write = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function dataDirFromArgs(args) {
  if (args.data) return path.resolve(args.data);
  return defaultDataDir();
}

function cmdSetup(args) {
  const projectRoot = resolveProjectRoot(args.project);
  const dataDir = dataDirFromArgs(args);
  ensureDataDir(dataDir);
  rebuildSummary(dataDir);

  let hooksMsg = "hooks skipped (pass --hooks to merge)";
  if (args.hooks) {
    hooksMsg = mergeHooks(projectRoot);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectRoot,
        dataDir,
        hooks: hooksMsg,
      },
      null,
      2
    )
  );
}

function mergeHooks(projectRoot) {
  const fragmentPath = path.join(__dirname, "hooks", "hooks.fragment.json");
  const hookScript = path.join(__dirname, "hooks", "on-read-skill.mjs");
  if (!fs.existsSync(fragmentPath) || !fs.existsSync(hookScript)) {
    return "hook templates missing";
  }

  const cursorDir = path.join(projectRoot, ".cursor");
  const hooksDir = path.join(cursorDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const destHook = path.join(hooksDir, "skill-monitor-on-read.mjs");
  fs.copyFileSync(hookScript, destHook);

  // Patch DATA_DIR / CLI path into copied hook via env comment — hook resolves relative to project
  const hooksJsonPath = path.join(cursorDir, "hooks.json");
  let existing = { version: 1, hooks: {} };
  if (fs.existsSync(hooksJsonPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8"));
    } catch {
      // keep default
    }
  }
  if (!existing.version) existing.version = 1;
  if (!existing.hooks) existing.hooks = {};

  const fragment = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));
  // Use node so the hook runs on Windows without a Unix shebang executor
  const command = `node .cursor/hooks/skill-monitor-on-read.mjs`;
  for (const [event, list] of Object.entries(fragment.hooks || {})) {
    if (!existing.hooks[event]) existing.hooks[event] = [];
    const already = existing.hooks[event].some(
      (h) => h.command && String(h.command).includes("skill-monitor-on-read")
    );
    if (!already) {
      for (const item of list) {
        existing.hooks[event].push({
          ...item,
          command,
        });
      }
    }
  }

  fs.writeFileSync(hooksJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  return `merged into ${hooksJsonPath}; script at ${destHook}`;
}

function cmdRecord(args) {
  const dataDir = dataDirFromArgs(args);
  const filePath = args.path;
  if (!filePath && !args.skill) {
    console.error("record requires --path <SKILL.md> or --skill <name>");
    process.exit(1);
  }
  if (filePath && !isSkillMdPath(filePath) && !args.skill) {
    console.error("path does not look like SKILL.md; pass --skill to force");
    process.exit(1);
  }
  const { event, skipped } = recordEvent(
    {
      path: filePath || "",
      skill: args.skill || (filePath ? skillNameFromPath(filePath) : undefined),
      source: args.source || "manual",
      sessionId: args.session || null,
      tool: args.tool || "cursor",
      dedupeKey: args.dedupe || null,
    },
    dataDir,
    { dedupe: Boolean(args.dedupe) }
  );
  console.log(JSON.stringify({ ok: true, skipped, event }, null, 2));
}

function cmdListSkills(args) {
  const discovered = discoverSkills({ project: args.project });
  console.log(listSkillsMarkdown(discovered));
}

function cmdSummary(args) {
  const dataDir = dataDirFromArgs(args);
  const summary = readSummary(dataDir);
  console.log(JSON.stringify(summary, null, 2));
}

function cmdAnalyze(args) {
  const dataDir = dataDirFromArgs(args);
  const projectRoot = resolveProjectRoot(args.project);
  ensureDataDir(dataDir);
  const summary = rebuildSummary(dataDir);
  const discovered = discoverSkills({ project: projectRoot });

  const byName = { ...summary.skills };
  const scopeRank = { project: 0, user: 1, builtin: 2, other: 3, orphan: 4 };
  // One row per skill name; prefer project > user > builtin path
  const bestByName = new Map();
  for (const s of discovered.skills) {
    const prev = bestByName.get(s.name);
    if (
      !prev ||
      (scopeRank[s.scope] ?? 9) < (scopeRank[prev.scope] ?? 9)
    ) {
      bestByName.set(s.name, s);
    }
  }

  const rows = [];
  for (const s of bestByName.values()) {
    const stats = byName[s.name] || {
      count: 0,
      uniqueSessions: 0,
      lastUsed: null,
      paths: [s.path],
      sources: {},
    };
    rows.push({
      name: s.name,
      scope: s.scope,
      count: stats.count || 0,
      uniqueSessions: stats.uniqueSessions || 0,
      lastUsed: stats.lastUsed || "-",
      path: s.path,
    });
    delete byName[s.name];
  }

  // Events for skills not found on disk anymore
  for (const [name, stats] of Object.entries(byName)) {
    if (!isValidOrphanName(name)) continue;
    rows.push({
      name,
      scope: "orphan",
      count: stats.count || 0,
      uniqueSessions: stats.uniqueSessions || 0,
      lastUsed: stats.lastUsed || "-",
      path: (stats.paths && stats.paths[0]) || "-",
    });
  }

  const reportMeta = [
    `# Skill usage frequency`,
    "",
    `- Project: \`${projectRoot}\``,
    `- Data: \`${dataDir}\``,
    `- Discovered skills (unique names): ${bestByName.size} (${discovered.skills.length} paths)`,
    `- Total recorded events: ${summary.totalEvents}`,
    `- Report generated: ${new Date().toISOString()}`,
    "",
    `| Rank | Skill | Scope | Calls | Sessions | Share | Last used |`,
    `| --- | --- | --- | ---: | ---: | ---: | --- |`,
  ];

  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = rows.reduce((n, r) => n + r.count, 0);

  const lines = [...reportMeta];

  rows.forEach((r, i) => {
    const share =
      total > 0 ? ((r.count / total) * 100).toFixed(1) + "%" : "0%";
    lines.push(
      `| ${i + 1} | ${r.name} | ${r.scope} | ${r.count} | ${r.uniqueSessions} | ${share} | ${r.lastUsed} |`
    );
  });

  lines.push("");
  lines.push(
    `_Calls = each recorded load. Sessions = distinct sessionId values (when available)._`
  );
  lines.push(
    `_Capture is best-effort (hook + backfill + manual). Not every tool exposes skill-use events._`
  );

  const report = lines.join("\n") + "\n";
  console.log(report);

  if (args.write) {
    const out = path.join(dataDir, "report.md");
    fs.writeFileSync(out, report, "utf8");
    console.error(`Wrote ${out}`);
  }
}

function cmdBackfill(args) {
  const dataDir = dataDirFromArgs(args);
  ensureDataDir(dataDir);
  const cursor = readBackfillCursor(dataDir);
  if (!cursor.processed) cursor.processed = {};

  const files = listCursorTranscripts({
    projectFilter: args["project-filter"] || args.projectFilter || null,
  });

  let scanned = 0;
  let recorded = 0;
  let skipped = 0;

  for (const file of files) {
    scanned += 1;
    const fileKey = normalizePath(file);
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    const stamp = `${st.mtimeMs}:${st.size}`;
    if (cursor.processed[fileKey] === stamp) {
      skipped += 1;
      continue;
    }

    const events = parseTranscriptFile(file);
    for (const ev of events) {
      const result = recordEvent(ev, dataDir, { dedupe: true });
      if (result.skipped) skipped += 1;
      else recorded += 1;
    }
    cursor.processed[fileKey] = stamp;
  }

  cursor.updatedAt = new Date().toISOString();
  writeBackfillCursor(dataDir, cursor);
  rebuildSummary(dataDir);

  console.log(
    JSON.stringify(
      {
        ok: true,
        transcriptFiles: files.length,
        scanned,
        recorded,
        skippedFilesOrDupes: skipped,
        dataDir,
      },
      null,
      2
    )
  );
}

function isValidOrphanName(name) {
  if (!name || name === "..." || name.includes("...")) return false;
  if (["templates", "scripts", "data", "skills", "hooks", "lib"].includes(name)) {
    return false;
  }
  return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || args.help) {
    printHelp();
    process.exit(cmd ? 0 : 1);
  }

  switch (cmd) {
    case "setup":
      cmdSetup(args);
      break;
    case "record":
      cmdRecord(args);
      break;
    case "list-skills":
      cmdListSkills(args);
      break;
    case "analyze":
      cmdAnalyze(args);
      break;
    case "backfill":
      cmdBackfill(args);
      break;
    case "summary":
      cmdSummary(args);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
