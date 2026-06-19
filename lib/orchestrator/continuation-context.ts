import type { QuizPayload } from "../ai/schemas";
import type { TeacherMessage } from "./teacher";

// 002 T012 (US1): pure builder for the teacher context after a quiz answer. Tells the teacher what
// just happened (correct/incorrect) and asks for exactly one next-step turn. Deterministic.

export function buildContinuationContext(
  quiz: QuizPayload,
  chosenIndex: number,
  correct: boolean,
): TeacherMessage[] {
  const chosen = quiz.choices[chosenIndex] ?? "(?)";
  const correctChoice = quiz.choices[quiz.correctIndex] ?? "(?)";

  const outcome = correct
    ? `أجاب الطالب الاختبار بشكل صحيح. السؤال: «${quiz.question}». اختار: «${chosen}» (صحيح).`
    : `أجاب الطالب الاختبار بشكل خاطئ. السؤال: «${quiz.question}». اختار: «${chosen}»، والإجابة الصحيحة: «${correctChoice}».`;

  const lead = correct
    ? "هنّئه باختصار ثم انتقل للخطوة التالية المناسبة (سؤال متابعة أو عنصر أصعب قليلاً). رسالة واحدة قصيرة فقط، ثم انتظر ردّه."
    : "عزّز النقطة بلطف (إعادة شرح موجزة بالعربية أو مثال أسهل) دون إحباط. رسالة واحدة قصيرة فقط، ثم انتظر ردّه.";

  return [{ role: "user", content: `${outcome}\n${lead}` }];
}
