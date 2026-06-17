# Quickstart — Validation & Run Guide (v1)

How to set up, run, and prove the v1 tutor works end-to-end. This is a validation guide;
implementation details live in `tasks.md` and the code. References: [plan](./plan.md),
[data-model](./data-model.md), [contracts](./contracts/).

## Prerequisites
- Node.js 22 LTS, a package manager, Docker (for the production-shaped run).
- A Supabase Postgres database (connection string).
- A Telegram bot token (`@BotFather`) and your Telegram user id.
- An OpenRouter API key.
- The morphology data files available at the app working directory (copied from
  `nlptoolkit-morphologicalanalysis` / `nlptoolkit-dictionary` — see research A1): they MUST be
  present or the analyzer cannot start.

## Environment (`.env`, never committed)
See `docs/08`. Required: `OPENROUTER_API_KEY`, `TEACHER_MODEL`, `ANALYZER_MODEL`, `DATABASE_URL`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_TELEGRAM_USER_ID`, `APP_URL`.
> Before any production run, re-pull OpenRouter `api/v1/models` and confirm the model IDs are live
> (docs/08); the defaults are validated by eval, not assumed.

## Setup
1. Install dependencies; pin versions at install.
2. Apply Drizzle migrations to the database (creates the 8 tables).
3. Seed: the learner profile (your `telegram_user_id` + settings), the authored A1→A2 curriculum
   tree (`data/curriculum/`), and ensure the golden set exists (`data/golden/`).
4. Register the Telegram webhook to `${APP_URL}/api/telegram` with the secret token.

## Run
- **Dev**: run the Next.js dev server; expose `APP_URL` over HTTPS (tunnel) for the webhook.
- **Prod**: build the Next.js standalone output; run the Docker image (long-lived Node process,
  not serverless) on the VPS; the in-process scheduler starts with it.

## Automated checks (must pass)
- `npm test` — Vitest over all pure modules (`srs`, `mastery`, `curriculum`, `eval`,
  `telegram` splitting). Must be green (FR-029, SC-007, SC-010).
- `npm run eval` — F0.5 + overcorrection rate per CEFR level over the golden set; records/compares
  the baseline. The GitHub Actions gate runs this on teacher/analyzer prompt or model changes and
  blocks regression (FR-030, SC-001).

## End-to-end validation scenarios
Map to the spec's user stories and success criteria.

1. **Deep correction, no overcorrection (US1 / SC-002, SC-009)**
   - Send `Ben okul gidiyorum` (missing dative). → Reply arrives promptly and naturally; shortly
     after, an `error_log` row names the dative case and explains why `-a/-e` is needed.
   - Send a correct sentence (e.g. `Bugün okula gidiyorum`). → No correction is recorded.
   - Expected: invalid Turkish never reaches you (morphology gate); correct input is not "fixed".

2. **Reply never blocked by analysis (US1 / SC-003)**
   - Send a message and observe streaming begins immediately; the `messages` row exists with
     `analyzed_at` null briefly, then set after background analysis.
   - Kill the process right after a reply; on restart, the backfill sweep analyzes the message with
     `analyzed_at IS NULL` (SC-004 — no silent loss).

3. **Adaptation across sessions (US2 / SC-005, SC-006, SC-008)**
   - Use a grammar point correctly across two sessions → its `grammar_mastery` advances to
     `mastered` only after the evidence threshold; one later mistake dips but does not demote.
   - State a new goal in chat → `/progress` shows the next focus shifted accordingly.

4. **SRS capture & review (US3 / SC-007)**
   - Introduce a new word in chat → a unique `vocab_cards` row is created, linked to its message.
   - `/review` → reveal → rate; the same rating always yields the same `due_at` (deterministic).

5. **Onboarding, progress, reminder (US4)**
   - `/start` on a fresh profile → light placement, conservative A1, faster early movement.
   - `/progress` → per-skill CEFR, focus, weaknesses, due reviews, streak/XP.
   - Scheduler tick → daily reminder delivered.

6. **Reliability & security (cross-cutting / SC-004)**
   - Send a >4096-char-inducing prompt → reply splits into sequential messages.
   - Message from a non-authorized Telegram user → ignored.
   - Force an AI error → friendly message to you; technical detail only in logs; self-alert fires.

## Definition of done (v1)
All automated checks green; scenarios 1–6 pass; the A1→A2 curriculum tree and the ≥150-case golden
set exist and are human-verified; eval baseline recorded and the gate active.
