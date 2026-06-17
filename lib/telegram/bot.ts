import { Bot } from "grammy";
import { getEnv } from "../config/env";
import { FRIENDLY_ERROR, logError } from "../config/logger";
import { realAnalyzer } from "../analyzer";
import { handleTurn } from "../orchestrator/turn";
import { streamTeacher } from "../orchestrator/teacher";
import { dbStores, flagMessage, getProfileId } from "../orchestrator/store";
import type { TeacherPort } from "../orchestrator/ports";
import { streamToTelegram } from "./render";

// T036: thin Telegram client. Adapts updates → engine; renders engine output. No pedagogy here
// (Principle VII). Auth: a middleware restricts to the single authorized learner; the webhook
// secret token is checked by the route's webhookCallback.

let bot: Bot | null = null;

export function getBot(): Bot {
  if (bot) return bot;
  const env = getEnv();
  const b = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Authorization: ignore everyone but the single authorized learner (FR-028).
  b.use(async (ctx, next) => {
    if (ctx.from?.id === env.ALLOWED_TELEGRAM_USER_ID) await next();
  });

  b.command("start", async (ctx) => {
    await ctx.reply(
      "مرحباً! أنا معلّمك التركي. تحدّث معي بالتركية أو العربية ودعنا نبدأ. 🇹🇷\n" +
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

    const teacher: TeacherPort = async ({ text }) => {
      const stream = streamTeacher([{ role: "user", content: text }]);
      const reply = await streamToTelegram(ctx, chatId, stream.textStream);
      return { reply, mode: "discuss", quiz: null };
    };

    try {
      const result = await handleTurn(profileId, ctx.message.text, {
        stores: dbStores,
        teacher,
        analyzer: realAnalyzer,
      });
      // Reply already delivered (streamed). Run analysis afterward — never blocks the reply.
      void result.runAnalysis().catch((err) => logError("bot.analysis", err));
    } catch (err) {
      logError("bot.turn", err);
      await ctx.reply(FRIENDLY_ERROR);
    }
  });

  // 🚩 flag a suspected bad correction (FR-010).
  b.callbackQuery(/^flag:(.+)$/, async (ctx) => {
    const messageId = ctx.match?.[1];
    if (messageId) await flagMessage(messageId);
    await ctx.answerCallbackQuery({ text: "🚩 شكراً، سنراجعها." });
  });

  bot = b;
  return b;
}
