import fs from "node:fs";

/**
 * Rough token estimate for skill markdown.
 * - CJK ideographs ≈ 1 token each
 * - other characters ≈ 4 chars per token
 * Not a billing-accurate tokenizer.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x3040 && cp <= 0x30ff) ||
      (cp >= 0xac00 && cp <= 0xd7af)
    ) {
      cjk += 1;
    } else {
      other += 1;
    }
  }
  return Math.max(0, Math.ceil(cjk + other / 4));
}

export function estimateTokensFromFile(filePath) {
  if (!filePath) return 0;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return estimateTokens(text);
  } catch {
    return 0;
  }
}

/** Tokens for one load of a skill file (0 if missing). */
export function fileTokenSize(filePath) {
  return estimateTokensFromFile(filePath);
}
