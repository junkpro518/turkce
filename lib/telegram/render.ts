import type { Context } from "grammy";
import { logWarn } from "../config/logger";
import { splitMessage } from "./split";

// T037: simulate streaming by editing one message every ~1.5s with a typing action, then split the
// final text across messages if it exceeds the limit (FR-004). Returns the full text so the caller
// can persist it. Telegram I/O — verified by build/typecheck, exercised live.

const EDIT_INTERVAL_MS = 1500;
const PLACEHOLDER = "…";

export async function streamToTelegram(
  ctx: Context,
  chatId: number,
  textStream: AsyncIterable<string>,
): Promise<string> {
  const placeholder = await ctx.api.sendMessage(chatId, PLACEHOLDER);
  const messageId = placeholder.message_id;

  let full = "";
  let lastEdit = Date.now();
  for await (const delta of textStream) {
    full += delta;
    const now = Date.now();
    if (now - lastEdit > EDIT_INTERVAL_MS && full.length > 0 && full.length <= 4096) {
      lastEdit = now;
      try {
        await ctx.api.sendChatAction(chatId, "typing");
        await ctx.api.editMessageText(chatId, messageId, full);
      } catch (err) {
        logWarn("telegram.render", "interim edit failed (continuing)", { err: String(err) });
      }
    }
  }

  const parts = splitMessage(full.length > 0 ? full : PLACEHOLDER);
  await ctx.api.editMessageText(chatId, messageId, parts[0]!);
  for (let i = 1; i < parts.length; i++) {
    await ctx.api.sendMessage(chatId, parts[i]!);
  }
  return full;
}
