/**
 * Eval harness runner (T049, FR-030). Runs the REAL analyzer pipeline over the hand-authored
 * golden set and reports F0.5 over edit spans + overcorrection rate, per CEFR level.
 *
 *   OPENROUTER_API_KEY=... npx tsx lib/eval/run.ts          (or: npm run eval, env provided)
 *   OPENROUTER_API_KEY=... npx tsx --env-file=.env lib/eval/run.ts
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { A1_GOLDEN, type GoldenCase } from "../../data/golden/a1";
import { A1_KEYS } from "../../data/curriculum/keys";
import { analyzeMessage } from "../analyzer/correct";
import { filterOvercorrections } from "../analyzer/overcorrection";
import { ANALYZER_SYSTEM, OVERCORRECTION_SYSTEM } from "../ai/prompts";
import {
  AnalysisResultSchema,
  OvercorrectionVerdictSchema,
  type AnalysisError,
} from "../ai/schemas";
import { extractEdits, toScoreEdit } from "./edits";
import { scoreCases, type EvalCase } from "./score";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY (e.g. npx tsx --env-file=.env lib/eval/run.ts)");
  process.exit(1);
}
const modelId = process.env.ANALYZER_MODEL ?? "openai/gpt-5";
const openrouter = createOpenRouter({ apiKey });
const model = openrouter(modelId);
const KNOWN = new Set(A1_KEYS.map((n) => n.key));

async function rawAnalyze(text: string): Promise<unknown> {
  const { object } = await generateObject({
    model,
    schema: AnalysisResultSchema,
    temperature: 0.1,
    system: ANALYZER_SYSTEM,
    prompt: text,
  });
  return object;
}

async function verdict(e: AnalysisError) {
  const { object } = await generateObject({
    model,
    schema: OvercorrectionVerdictSchema,
    temperature: 0.1,
    system: OVERCORRECTION_SYSTEM,
    prompt: `Original: ${e.original}\nProposed correction: ${e.correction}\nWas the original already correct?`,
  });
  return object;
}

async function evalCase(g: GoldenCase): Promise<EvalCase> {
  const res = await analyzeMessage({ generate: () => rawAnalyze(g.learner), knownKeys: KNOWN });
  const errors = await filterOvercorrections(res.errors, verdict);
  const pred = errors.flatMap((e) => extractEdits(e.original, e.correction)).map(toScoreEdit);
  const gold = (g.isCorrect ? [] : extractEdits(g.learner, g.correct)).map(toScoreEdit);

  const predStr = pred.map((p) => p.replacement).join(", ") || "—";
  const goldStr = gold.map((p) => p.replacement).join(", ") || "—";
  const ok = predStr === goldStr ? "✓" : "✗";
  console.log(`${ok} "${g.learner}"\n    gold: ${goldStr}\n    pred: ${predStr}`);

  return { gold, pred, isCorrectSentence: g.isCorrect };
}

async function main() {
  console.log(`Eval — model: ${modelId} — ${A1_GOLDEN.length} A1 cases\n${"=".repeat(60)}`);
  const cases: EvalCase[] = [];
  for (const g of A1_GOLDEN) {
    cases.push(await evalCase(g));
  }
  const s = scoreCases(cases);
  console.log("\n" + "=".repeat(60));
  console.log("BASELINE (A1):");
  console.log(`  precision        ${s.precision.toFixed(3)}`);
  console.log(`  recall           ${s.recall.toFixed(3)}`);
  console.log(`  F0.5             ${s.f05.toFixed(3)}`);
  console.log(`  overcorrection   ${(s.overcorrectionRate * 100).toFixed(1)}%`);
  console.log(`  tp/fp/fn         ${s.tp}/${s.fp}/${s.fn}`);
}

main().catch((err) => {
  console.error("eval failed:", err);
  process.exit(1);
});
