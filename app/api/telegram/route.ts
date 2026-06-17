import { webhookCallback } from "grammy";
import { getEnv } from "../../../lib/config/env";
import { getBot } from "../../../lib/telegram/bot";

// T036: Telegram webhook endpoint. Long-lived Node runtime (not edge) — the engine uses Postgres,
// the morphology analyzer, and background work. Lazy init so `next build` needs no secrets.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let handler: ((req: Request) => Promise<Response>) | null = null;

export async function POST(req: Request): Promise<Response> {
  if (!handler) {
    handler = webhookCallback(getBot(), "std/http", {
      secretToken: getEnv().TELEGRAM_WEBHOOK_SECRET,
    });
  }
  return handler(req);
}
