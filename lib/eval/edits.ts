// Token-level edit extraction for the eval harness (docs/09 Q3). A1 errors are typically one
// contiguous change, so we trim the common token prefix/suffix and treat the differing middle as a
// single edit. Deterministic and pure. (Upgradeable to full M2-style alignment later.)

import type { Edit } from "./score";

export interface TokenEdit {
  source: string;
  target: string;
}

function tokenize(s: string): string[] {
  return s
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => t.length > 0);
}

export function extractEdits(source: string, target: string): TokenEdit[] {
  const s = tokenize(source);
  const t = tokenize(target);
  if (s.join(" ") === t.join(" ")) return [];

  let start = 0;
  while (start < s.length && start < t.length && s[start] === t[start]) start++;
  let endS = s.length;
  let endT = t.length;
  while (endS > start && endT > start && s[endS - 1] === t[endT - 1]) {
    endS--;
    endT--;
  }
  const src = s.slice(start, endS).join(" ");
  const tgt = t.slice(start, endT).join(" ");
  if (src === "" && tgt === "") return [];
  return [{ source: src, target: tgt }];
}

/** Encode a token edit as a score.Edit keyed by the source→target change (position-independent). */
export function toScoreEdit(e: TokenEdit): Edit {
  return { start: 0, end: 0, replacement: `${e.source}=>${e.target}` };
}
