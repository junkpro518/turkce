import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { FsmMorphologicalAnalyzer } from "nlptoolkit-morphologicalanalysis";

// Layer-0 deterministic morphological gate (docs/09 Q2, FR-008). A Turkish form with zero
// morphological analyses is invalid → reject + regenerate. Verified during planning: garbage
// words yield 0 analyses. This is a "definitely-reject" filter (morphological validity only).

const require = createRequire(import.meta.url);

// The analyzer reads these from the process cwd. We copy any missing ones from node_modules once.
const DATA_FILES: Record<string, string> = {
  "turkish_finite_state_machine.xml": "nlptoolkit-morphologicalanalysis",
  "suffixes.txt": "nlptoolkit-morphologicalanalysis",
  "pronunciations.txt": "nlptoolkit-morphologicalanalysis",
  "turkish_dictionary.txt": "nlptoolkit-dictionary",
  "turkish_misspellings.txt": "nlptoolkit-dictionary",
  "turkish_morphological_lexicon.txt": "nlptoolkit-dictionary",
};

let analyzer: FsmMorphologicalAnalyzer | null = null;

function ensureDataFiles(): void {
  for (const [file, pkg] of Object.entries(DATA_FILES)) {
    const dest = join(process.cwd(), file);
    if (existsSync(dest)) continue;
    let pkgDir: string;
    try {
      pkgDir = dirname(require.resolve(`${pkg}/package.json`));
    } catch {
      continue;
    }
    const src = join(pkgDir, file);
    if (existsSync(src)) copyFileSync(src, dest);
  }
}

/** Lazily build the analyzer once (the dictionary load is heavy — never per request). */
export function getAnalyzer(): FsmMorphologicalAnalyzer {
  if (!analyzer) {
    ensureDataFiles();
    analyzer = new FsmMorphologicalAnalyzer();
  }
  return analyzer;
}

function stripEdgePunctuation(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** True if the single word has ≥1 morphological analysis. */
export function isValidWord(word: string): boolean {
  const w = stripEdgePunctuation(word.trim());
  if (!w) return false;
  const list = getAnalyzer().morphologicalAnalysis(w) as { size?: () => number; length?: number };
  const count = typeof list.size === "function" ? list.size() : (list.length ?? 0);
  return count > 0;
}

/** True if every alphabetic token in the text is morphologically valid. */
export function isValidText(text: string): boolean {
  const tokens = text.split(/\s+/).filter((t) => /\p{L}/u.test(t));
  if (tokens.length === 0) return false;
  return tokens.every(isValidWord);
}
