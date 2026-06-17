# Contract — Telegram Webhook

The single external inbound interface for v1. The Telegram client is **thin** (Principle VII): it
authenticates, adapts the update into an engine call, and renders the engine's output. It holds no
pedagogical logic.

## Endpoint
- `POST /api/telegram` — receives Telegram `Update` objects (grammY `webhookCallback`).
- Registered via `setWebhook` to `${APP_URL}/api/telegram` with a secret token.

## Authentication (FR-028)
1. **Webhook secret**: verify the `X-Telegram-Bot-Api-Secret-Token` header equals
   `TELEGRAM_WEBHOOK_SECRET`. Mismatch → `401`, ignore.
2. **Authorized user**: the update's `from.id` MUST equal `ALLOWED_TELEGRAM_USER_ID`. Any other
   user → silently ignored (no reply).

## Inbound → engine mapping
| Telegram input | Engine action |
|----------------|---------------|
| Text message | `orchestrator.handleTurn(profile, text)` → stream reply; persist message; schedule background analysis |
| `/start` | onboarding / light placement (FR-022) |
| `/progress` | `progress.render(profile)` → text summary (FR-023) |
| `/review` | start an SRS review session (due cards) (FR-020) |
| Callback query (quiz answer) | grade choice → reveal correct/explanation |
| Callback query (SRS rating: forgot/hard/good/easy) | `srs.rate(card, rating)` → reschedule; next card |
| Callback query (🚩 flag) | mark `messages.flagged = true` (FR-010) |

## Outbound rendering (FR-004, FR-005)
- **Streamed reply**: send a placeholder, then `editMessageText` ~every 1.5s with a `typing` chat
  action, until the stream completes.
- **Message splitting**: any outbound text >4096 chars is split into sequential messages.
- **Quiz**: `QuizPayload` → inline keyboard (one button per choice); on answer, edit to show
  correct/incorrect + explanation.
- **SRS review**: word → "reveal" button → translation/example + four rating buttons.

## Reliability (Principle IV)
- The whole handler is wrapped: errors are logged (structured) and produce a friendly user message;
  technical detail is never shown.
- Teacher call: retry, then `TEACHER_MODEL` → fallback model, then friendly error.
- Telegram returns `200` quickly; long work (analysis) is not awaited before responding to the
  reply (but the inbound message is persisted first — research A2).
- Self-alert: on unhandled errors/outages, the bot messages the authorized learner (docs/09 Q12).

## Scheduling (not webhook-triggered)
The in-process scheduler (not this endpoint) drives: daily reminder (FR-024), idle-session sweep
(FR-031), SRS-due nudges, and the analysis-backfill sweep (research A2).
