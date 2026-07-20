#!/usr/bin/env node
/**
 * Cursor beforeReadFile hook: when a SKILL.md is read, append a usage event.
 * Always fail-open: print {} and exit 0 on any error.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", () => resolve(""));
  });
}

function extractPath(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.path,
    payload.filePath,
    payload.file_path,
    payload.absolutePath,
    payload.absolute_path,
    payload?.input?.path,
    payload?.tool_input?.path,
    payload?.args?.path,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length) return c;
  }
  return null;
}

function isSkillMd(filePath) {
  if (!filePath) return false;
  return path.basename(filePath).toLowerCase() === "skill.md";
}

function findCli() {
  // 1) Sibling layout after setup copy: .cursor/hooks/ → look for skill scripts
  const candidates = [
    path.resolve(__dirname, "..", "skills", "skill-monitor", "scripts", "cli.mjs"),
    path.resolve(
      __dirname,
      "..",
      "..",
      ".cursor",
      "skills",
      "skill-monitor",
      "scripts",
      "cli.mjs"
    ),
  ];

  // Walk up from cwd for project skill
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(
      path.join(dir, ".cursor", "skills", "skill-monitor", "scripts", "cli.mjs")
    );
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findDataDir(cliPath) {
  if (!cliPath) return null;
  // cli at …/skill-monitor/scripts/cli.mjs → data at …/skill-monitor/data
  return path.resolve(path.dirname(cliPath), "..", "data");
}

async function main() {
  let input = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) input = JSON.parse(raw);
  } catch {
    input = {};
  }

  try {
    const filePath = extractPath(input);
    if (isSkillMd(filePath)) {
      const cli = findCli();
      if (cli) {
        const dataDir = findDataDir(cli);
        const sessionId =
          input.session_id ||
          input.sessionId ||
          input.conversation_id ||
          input.conversationId ||
          null;
        const args = [
          cli,
          "record",
          "--path",
          filePath,
          "--source",
          "hook",
          "--tool",
          "cursor",
        ];
        if (dataDir) {
          args.push("--data", dataDir);
        }
        if (sessionId) {
          args.push("--session", String(sessionId));
        }
        spawnSync(process.execPath, args, {
          stdio: "ignore",
          windowsHide: true,
        });
      }
    }
  } catch {
    // fail-open
  }

  // beforeReadFile: allow read; empty/minimal JSON
  process.stdout.write("{}\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
});
