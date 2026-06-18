/**
 * Live deep-correction demo (proves US1 SC-002 / scenarios 1–2 end-to-end through the REAL
 * analyzer pipeline: strong model → Zod → morphology gate → anti-overcorrection).
 *
 * Needs only ONE secret. Run it yourself so the key never enters the repo or the chat:
 *
 *   ! OPENROUTER_API_KEY=sk-or-... npx tsx scripts/demo-correct.ts
 *
 * Optional: ANALYZER_MODEL=openai/gpt-5 (default). Then paste the output back.
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { A1_KEYS } from "../data/curriculum/keys";
import { analyzeMessage } from "../lib/analyzer/correct";
import { filterOvercorrections } from "../lib/analyzer/overcorrection";
import { ANALYZER_SYSTEM, OVERCORRECTION_SYSTEM } from "../lib/ai/prompts";
import {
  AnalysisResultSchema,
  OvercorrectionVerdictSchema,
  type AnalysisError,
} from "../lib/ai/schemas";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY. Example:\n  ! OPENROUTER_API_KEY=sk-or-... npx tsx scripts/demo-correct.ts");
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

const SAMPLES = [
  { text: "Ben okul gidiyorum.", note: "missing dative → expect okula + locative/dative reason" },
  { text: "Bugün okula gidiyorum.", note: "CORRECT → expect NO correction (overcorrection check)" },
  { text: "Yarın sinemaya gitecegim.", note: "expect gideceğim (consonant + buffer)" },
  { text: "Dün eve geldim.", note: "CORRECT past tense → expect NO correction" },
];

async function main() {
  console.log(`Model: ${modelId}\n${"=".repeat(60)}`);
  for (const s of SAMPLES) {
    console.log(`\n📝 "${s.text}"   (${s.note})`);
    const res = await analyzeMessage({ generate: () => rawAnalyze(s.text), knownKeys: KNOWN });
    const errors = await filterOvercorrections(res.errors, verdict);
    if (errors.length === 0) {
      console.log("   ✅ no correction recorded");
    } else {
      for (const e of errors) {
        console.log(`   ✏️  ${e.original} → ${e.correction}  [${e.grammarPoint}, ${e.severity}]`);
        console.log(`      ${e.explanation}`);
      }
    }
    if (res.newVocab.length > 0) {
      console.log(`   📚 vocab: ${res.newVocab.map((v) => `${v.word}=${v.translation}`).join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error("demo failed:", err);
  process.exit(1);
});
