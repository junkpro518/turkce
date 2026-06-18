/**
 * Live teacher demo — confirms the teacher replies in Arabic (level-scaled) per the fixed prompt.
 *   npx tsx --env-file=.env scripts/demo-teacher.ts
 * Uses TEACHER_MODEL (default google/gemini-3.1-flash-lite) via the normal provider.
 */
import { buildTeacherSystem } from "../lib/ai/prompts";
import { decideTurn, generateTeacherDecisionRaw } from "../lib/orchestrator/teacher";

const SAMPLES = [
  "Ben okul gidiyorum.", // beginner error — expect Arabic explanation + Turkish form glossed
  "Merhaba! Nasılsın?", // greeting — expect warm Arabic-led reply
];

async function main() {
  const system = buildTeacherSystem("A1", "arabic_heavy");
  for (const text of SAMPLES) {
    console.log(`\n📝 "${text}"\n${"-".repeat(50)}`);
    const decision = await decideTurn({
      generate: () => generateTeacherDecisionRaw([{ role: "user", content: text }], system),
    });
    if (!decision) {
      console.log("   (teacher returned null)");
      continue;
    }
    console.log(`mode: ${decision.mode}`);
    console.log(`reply:\n${decision.reply}`);
    if (decision.quiz) console.log(`quiz: ${JSON.stringify(decision.quiz, null, 2)}`);
  }
}

main().catch((err) => {
  console.error("demo-teacher failed:", err);
  process.exit(1);
});
