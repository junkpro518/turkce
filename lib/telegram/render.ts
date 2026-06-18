import type { Context } from "grammy";
import { splitMessage } from "./split";

// T037: deliver a reply with a typing indicator, splitting messages over the Telegram limit
// (FR-004). The teacher now returns a full structured reply, so this sends rather than streams
// token-by-token; the typing action keeps it feeling live.

export async function sendReply(ctx: Context, chatId: number, text: string): Promise<void> {
  const body = text.length > 0 ? text : "…";
  try {
    await ctx.api.sendChatAction(chatId, "typing");
  } catch {
    // non-fatal
  }
  const parts = splitMessage(body);
  for (const part of parts) {
    await ctx.api.sendMessage(chatId, part);
  }
}
