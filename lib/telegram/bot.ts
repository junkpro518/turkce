import { Bot, type Context } from "grammy";
import { getEnv } from "../config/env";
import { FRIENDLY_ERROR, logError } from "../config/logger";
import { realAnalyzer } from "../analyzer";
import { handleTurn } from "../orchestrator/turn";
import { decideTurn, generateTeacherDecisionRaw } from "../orchestrator/teacher";
import { continueAfterQuiz } from "../orchestrator/continuation";
import { buildTeacherSystem } from "../ai/prompts";
import {
  dbStores,
  findMessageByTelegramId,
  flagMessage,
  getProfileContext,
  getProfileId,
  setTelegramMessageId,
  touchLastActive,
} from "../orchestrator/store";
import type { TeacherPort } from "../orchestrator/ports";
import type { QuizPayload } from "../ai/schemas";
import { buildQuizKeyboard, gradeQuiz } from "./quiz";
import { sendReply } from "./render";

// Thin Telegram client. Adapts updates → engine; renders engine output. No pedagogy here
// (Principle VII). Auth: middleware restricts to the single authorized learner; the webhook secret
// token is checked by the route's webhookCallback. Quiz state is DB-backed (002 FR-004 — survives
// restarts), and the quiz answer continues the conversation (002 US1).

let bot: Bot | null = null;

/** Send a quiz card and link its Telegram message id to the persisted assistant message. */
async function sendQuizCardAndLink(
  ctx: Context,
  chatId: number,
  assistantMessageId: string,
  quiz: QuizPayload,
): Promise<void> {
  const sent = await ctx.api.sendMessage(chatId, quiz.question, {
    reply_markup: buildQuizKeyboard(quiz),
  });
  await setTelegramMessageId(assistantMessageId, sent.message_id);
}

export function getBot(): Bot {
  if (bot) return bot;
  const env = getEnv();
  const b = new Bot(env.TELEGRAM_BOT_TOKEN);

  b.use(async (ctx, next) => {
    if (ctx.from?.id === env.ALLOWED_TELEGRAM_USER_ID) await next();
  });

  b.command("start", async (ctx) => {
    await ctx.reply(
      "مرحباً! أنا معلّمك التركي. تحدّث معي بالتركية أو العربية ولنبدأ. 🇹🇷\n" +
        "Merhaba! Türkçe konuşmaya başlayalım.",
    );
  });

  b.on("message:text", async (ctx) => {
    const tgId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (tgId == null || chatId == null) return;

    const profileId = await getProfileId(tgId);
    if (!profileId) {
      await ctx.reply("لم يتم إعداد ملفك بعد. أرسل /start.");
      return;
    }
    await touchLastActive(profileId); // 002 X2: message = activity

    // Teacher port: structured judgment → render the text reply. The quiz card (if any) is sent
    // after handleTurn persists the assistant message, so it can be linked for restart-safe grading.
    const teacher: TeacherPort = async ({ text }) => {
      const { cefrOverall, languageMix } = await getProfileContext(profileId);
      const system = buildTeacherSystem(cefrOverall, languageMix);
      const decision = await decideTurn({
        generate: () => generateTeacherDecisionRaw([{ role: "user", content: text }], system),
      });
      if (!decision) {
        await sendReply(ctx, chatId, FRIENDLY_ERROR);
        return { reply: FRIENDLY_ERROR, mode: "discuss", quiz: null };
      }
      await sendReply(ctx, chatId, decision.reply);
      return { reply: decision.reply, mode: decision.mode, quiz: decision.quiz };
    };

    try {
      const result = await handleTurn(profileId, ctx.message.text, {
        stores: dbStores,
        teacher,
        analyzer: realAnalyzer,
      });
      if (result.quiz) await sendQuizCardAndLink(ctx, chatId, result.assistantMessageId, result.quiz);
      void result.runAnalysis().catch((err) => logError("bot.analysis", err));
    } catch (err) {
      logError("bot.turn", err);
      await ctx.reply(FRIENDLY_ERROR);
    }
  });

  // Quiz answer (FR-005) + continuation (002 US1): grade from DB, reveal, then lead the next step.
  b.callbackQuery(/^quiz:(\d+)$/, async (ctx) => {
    const idx = Number(ctx.match[1]);
    const tgMsgId = ctx.callbackQuery.message?.message_id;
    const chatId = ctx.chat?.id;
    const tgId = ctx.from?.id;
    if (tgMsgId == null || chatId == null || tgId == null) {
      await ctx.answerCallbackQuery();
      return;
    }

    const row = await findMessageByTelegramId(tgMsgId);
    const quiz = (row?.modePayload ?? null) as QuizPayload | null;
    if (!row || !quiz) {
      // 002 FR-004: never a silent dead button (e.g. card sent before a restart had no link).
      await ctx.answerCallbackQuery({ text: "انتهت صلاحية هذه البطاقة." });
      return;
    }

    const grade = gradeQuiz(quiz, idx);
    await ctx.answerCallbackQuery({ text: grade.correct ? "✅ صحيح!" : "❌ خطأ" });
    const mark = grade.correct ? "✅" : "❌";
    await ctx.api.editMessageText(
      chatId,
      tgMsgId,
      `${quiz.question}\n\n${mark} ${quiz.choices[idx] ?? ""}\n\n${grade.explanation}`,
    );

    // Continuation: exactly one teacher-led next step (US1). Never recurses.
    const profileId = await getProfileId(tgId);
    if (!profileId) return;
    await touchLastActive(profileId); // a button press is activity too
    try {
      const { cefrOverall, languageMix } = await getProfileContext(profileId);
      const decision = await continueAfterQuiz(quiz, idx, grade.correct, {
        level: cefrOverall,
        languageMix,
      });
      if (!decision) {
        await sendReply(ctx, chatId, "أحسنت! تابِع متى شئت. 🙂");
        return;
      }
      const session = await dbStores.getOrOpenSession(profileId);
      const assistant = await dbStores.insertMessage({
        sessionId: session.id,
        role: "assistant",
        content: decision.reply,
        mode: decision.mode,
        modePayload: decision.quiz ?? null,
      });
      await sendReply(ctx, chatId, decision.reply);
      if (decision.quiz) await sendQuizCardAndLink(ctx, chatId, assistant.id, decision.quiz);
    } catch (err) {
      logError("bot.continuation", err);
    }
  });

  // 🚩 flag a suspected bad correction (FR-010).
  b.callbackQuery(/^flag:(.+)$/, async (ctx) => {
    const messageId = ctx.match[1];
    if (messageId) await flagMessage(messageId);
    await ctx.answerCallbackQuery({ text: "🚩 شكراً، سنراجعها." });
  });

  bot = b;
  return b;
}
