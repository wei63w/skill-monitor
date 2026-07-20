#!/usr/bin/env node
/**
 * Cursor subagentStart (and optional preToolUse Task) hook:
 * record sub-agent startup with current Rules/AGENTS.md volume.
 * Fail-open: always print {} / allow.
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

function findCli() {
  const candidates = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(
      path.join(dir, ".cursor", "skills", "skill-monitor", "scripts", "cli.mjs")
    );
    candidates.push(
      path.join(dir, "skills", "skill-monitor", "scripts", "cli.mjs")
    );
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(
    path.resolve(__dirname, "..", "..", "scripts", "cli.mjs"),
    path.resolve(
      __dirname,
      "..",
      "skills",
      "skill-monitor",
      "scripts",
      "cli.mjs"
    )
  );
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findDataDir(cliPath) {
  if (!cliPath) return null;
  return path.resolve(path.dirname(cliPath), "..", "data");
}

function extractType(payload) {
  if (!payload || typeof payload !== "object") return "unknown";
  return (
    payload.subagent_type ||
    payload.subagentType ||
    payload.type ||
    payload?.input?.subagent_type ||
    payload?.tool_input?.subagent_type ||
    payload?.args?.subagent_type ||
    "unknown"
  );
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
    const cli = findCli();
    if (cli) {
      const dataDir = findDataDir(cli);
      const typ = extractType(input);
      const sessionId =
        input.session_id ||
        input.sessionId ||
        input.conversation_id ||
        input.conversationId ||
        null;
      const args = [
        cli,
        "record-task",
        "--type",
        String(typ),
        "--source",
        "hook",
        "--tool",
        "cursor",
        "--project",
        process.cwd(),
      ];
      if (dataDir) args.push("--data", dataDir);
      if (sessionId) args.push("--session", String(sessionId));
      spawnSync(process.execPath, args, {
        stdio: "ignore",
        windowsHide: true,
      });
    }
  } catch {
    // fail-open
  }

  // subagentStart may expect permission; empty object is safe
  process.stdout.write("{}\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
});
