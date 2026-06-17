import { streamText, type ModelMessage } from "ai";
import { TEMPERATURE, teacherFallbackModel, teacherModel } from "../ai/provider";
import { logError } from "../config/logger";

// T032: the live teacher call (streaming). Returns a streamText result whose `.textStream` the
// Telegram client consumes (FR-004). On a synchronous setup failure it retries with the backup
// model; mid-stream failures are handled by the caller's friendly fallback.

const TEACHER_SYSTEM = `You are a warm, intelligent Turkish tutor for an Arabic-speaking learner.
Speak Arabic and Turkish (no English). Read the learner and decide the interaction mode yourself —
discuss, answer, quiz, tell a story, role-play, or drill a weakness — grounded in their live state.
Keep replies natural and level-appropriate. Express uncertainty rather than asserting something you
are unsure is correct.`;

export function streamTeacher(messages: ModelMessage[], system: string = TEACHER_SYSTEM) {
  try {
    return streamText({
      model: teacherModel(),
      system,
      messages,
      temperature: TEMPERATURE.teacher,
    });
  } catch (err) {
    logError("teacher.primary", err);
    return streamText({
      model: teacherFallbackModel(),
      system,
      messages,
      temperature: TEMPERATURE.teacher,
    });
  }
}
