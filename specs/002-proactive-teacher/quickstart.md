# Quickstart — Validation (002 Proactive Teacher)

References: [plan](./plan.md), [data-model](./data-model.md), [contracts](./contracts/proactive.md).
Builds on 001's running app + DB.

## Prerequisites
- 001 deployed/running (engine, Telegram bot, DB). New env (optional, have defaults): `OUTREACH_TZ`,
  `OUTREACH_DAILY_CAP`, `OUTREACH_INACTIVITY_DAYS`, `OUTREACH_ACTIVE_START/END`, `SCHEDULER_TICK_MIN`.
- Apply the two migrations (messages.telegram_message_id, outreach_log) via the db-setup path.

## Automated checks (must pass)
- `npm test` — Vitest for `lib/outreach/decide` (quiet-hours, cap, active-guard, reminder-vs-nudge,
  determinism), `lib/outreach/messages` (Arabic, grounded), and the continuation trigger logic.
- `npm run typecheck` and `next build` green.

## End-to-end validation
1. **Continuation after quiz (US1 / SC-001, SC-002)**: trigger a quiz, tap an answer → reveal +
   exactly one next-step message (reinforce if wrong, advance if right); the tutor then waits (no
   chain).
2. **Quiz survives restart (SC-003)**: get a quiz card, restart the container, tap the answer → it
   still grades (or shows a friendly "card expired" — never a dead button).
3. **Daily reminder (US2 / SC-006)**: with due reviews, let the scheduler tick in the active window →
   one Arabic reminder grounded in due count; `outreach_log` gets a row.
4. **Inactivity nudge**: simulate `last_active` ≥ 2 days → one gentle Arabic nudge.
5. **Cap (SC-004)**: after 2 proactive messages today, further ticks send nothing.
6. **Quiet hours (SC-008)**: set tz-local time outside the active window → no outreach.
7. **Active guard (SC-005)**: send a message (become active) → next tick sends no outreach.
8. **Resilience (SC-007)**: force a send failure → logged, scheduler keeps running, retried next tick.

## Definition of done
All automated checks green; scenarios 1–8 pass; cap/quiet/active never violated; quiz never silent.
