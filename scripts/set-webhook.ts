/**
 * Register (or refresh) the Telegram webhook (T054). Run from anywhere with the env present —
 * it just calls the Telegram Bot API over HTTPS:
 *
 *   npx tsx --env-file=.env scripts/set-webhook.ts          # set
 *   npx tsx --env-file=.env scripts/set-webhook.ts info     # show current status
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

async function info() {
  const res = await fetch(api("getWebhookInfo"));
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function set() {
  if (!appUrl || !secret) {
    console.error("Missing APP_URL or TELEGRAM_WEBHOOK_SECRET");
    process.exit(1);
  }
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram`;
  const res = await fetch(api("setWebhook"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });
  console.log("setWebhook →", JSON.stringify(await res.json()));
  console.log("registered:", webhookUrl);
  await info();
}

const cmd = process.argv[2];
(cmd === "info" ? info() : set()).catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
