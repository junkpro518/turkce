import { Bot } from "grammy";
import { getEnv } from "../config/env";
import { FRIENDLY_ERROR, logError } from "../config/logger";
import { realAnalyzer } from "../analyzer";
import { handleTurn } from "../orchestrator/turn";
import { decideTurn, generateTeacherDecisionRaw } from "../orchestrator/teacher";
import { buildTeacherSystem } from "../ai/prompts";
import { dbStores, flagMessage, getProfileContext, getProfileId } from "../orchestrator/store";
import type { TeacherPort } from "../orchestrator/ports";
import type { QuizPayload } from "../ai/schemas";
import { buildQuizKeyboard, gradeQuiz } from "./quiz";
import { sendReply } from "./render";

// T036: thin Telegram client. Adapts updates → engine; renders engine output. No pedagogy here
// (Principle VII). Auth: middleware restricts to the single authorized learner; the webhook secret
// token is checked by the route's webhookCallback.

// Transient quiz UI state keyed by the Telegram message id (not learner state — fine to lose on
// restart). Single-user, long-lived process.
const quizStore = new Map<number, QuizPayload>();

let bot: Bot | null = null;

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

    // Teacher port: structured judgment → render reply, and a quiz card if the teacher chose to quiz.
    const teacher: TeacherPort = async ({ text }) => {
      const { cefrOverall, languageMix } = await getProfileContext(profileId);
      const system = buildTeacherSystem(cefrOverall, languageMix);
      const decision = await decideTurn({
        generate: () => generateTeacherDecisionRaw([{ role: "user", content: text }], system),
      });
      if (!decision) {
        await ctx.reply(FRIENDLY_ERROR);
        return { reply: FRIENDLY_ERROR, mode: "discuss", quiz: null };
      }
      await sendReply(ctx, chatId, decision.reply);
      if (decision.quiz) {
        const sent = await ctx.api.sendMessage(chatId, decision.quiz.question, {
          reply_markup: buildQuizKeyboard(decision.quiz),
        });
        quizStore.set(sent.message_id, decision.quiz);
      }
      return { reply: decision.reply, mode: decision.mode, quiz: decision.quiz };
    };

    try {
      const result = await handleTurn(profileId, ctx.message.text, {
        stores: dbStores,
        teacher,
        analyzer: realAnalyzer,
      });
      void result.runAnalysis().catch((err) => logError("bot.analysis", err));
    } catch (err) {
      logError("bot.turn", err);
      await ctx.reply(FRIENDLY_ERROR);
    }
  });

  // Quiz answer (FR-005): grade, reveal, clean up.
  b.callbackQuery(/^quiz:(\d+)$/, async (ctx) => {
    const idx = Number(ctx.match[1]);
    const msgId = ctx.callbackQuery.message?.message_id;
    const quiz = msgId != null ? quizStore.get(msgId) : undefined;
    if (!quiz || msgId == null || ctx.chat == null) {
      await ctx.answerCallbackQuery();
      return;
    }
    const grade = gradeQuiz(quiz, idx);
    await ctx.answerCallbackQuery({ text: grade.correct ? "✅ صحيح!" : "❌ خطأ" });
    const mark = grade.correct ? "✅" : "❌";
    await ctx.api.editMessageText(
      ctx.chat.id,
      msgId,
      `${quiz.question}\n\n${mark} ${quiz.choices[idx] ?? ""}\n\n${grade.explanation}`,
    );
    quizStore.delete(msgId);
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
