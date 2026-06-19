# Phase 0 — Research & Decisions (002)

Builds entirely on 001's verified stack; no new dependencies. Decisions below.

## D1. Outreach content: deterministic templates (not LLM)
- **Decision**: Reminders and nudges are **deterministic Arabic templates** parameterized by the
  learner model (due-review count, current focus). The teacher LLM is NOT called for outreach.
- **Rationale**: Outreach is a *support* function, not conversation → Principle I says make it
  deterministic + tested. Also cheaper (no per-tick LLM cost) and lets us hit SC-006 (language) and
  SC-007 (no failures) reliably. The continuation (US1) IS conversation → keeps the LLM teacher.
- **Alternatives**: LLM-composed reminders — rejected (cost + nondeterminism for a simple nudge).

## D2. Scheduler execution: Next instrumentation + setInterval
- **Decision**: Start one in-process scheduler via Next.js `instrumentation.ts` `register()` on
  server boot; `setInterval` every ~15 min. The tick runs: outreach evaluation, session-idle close
  (001 FR-031), SRS-due check, and analysis backfill (001 research A2) — the **unified** scheduler.
- **Rationale**: Long-lived single container (001 deployment) → in-process is correct and simplest;
  no queue/cron infra (Principle II). `register()` is Next's official startup hook. Single instance
  ⇒ no double-fire.
- **Alternatives**: external cron / BullMQ — rejected (infra overkill for one user); module-import
  side effect — rejected (less predictable than `register()`).

## D3. Quiz recovery across restart: DB lookup by Telegram message id
- **Decision**: Store the sent quiz card's Telegram `message_id` on the `messages` row
  (`telegram_message_id`). The quiz callback looks the row up by that id and grades from the
  persisted `mode_payload`. Remove the in-memory `quizStore`.
- **Rationale**: FR-004 / Principle IV — no volatile state; survives restart. The payload is already
  persisted in `messages.mode_payload`; only the id link was missing.
- **Alternatives**: encode answer key in callback data — rejected (explanation too long for 64-byte
  callback data); persist a separate quiz table — unnecessary (payload already on the message).

## D4. Continuation: one teacher turn, no loop
- **Decision**: On a quiz answer, after grade+reveal, synchronously call the existing structured
  teacher with context "the learner answered quiz X (correct/incorrect)"; send exactly one reply;
  persist it as an assistant message. It is triggered only by the user action and never re-triggers
  itself (no recursion → no self-talk loop). Analyzer is NOT run on a button press (no free-text to
  correct).
- **Rationale**: FR-001/FR-003. Reuses 001's `decideTurn`/teacher path (Arabic, level-scaled).
- **Alternatives**: a background continuation queue — unnecessary; recursive continuation — rejected
  (loop risk).

## D5. Outreach state + config
- **Decision**: New `outreach_log` table (profile_id, type, sent_at) for the 2/day cap, dedup, and
  restart recovery. Config (timezone, quiet window default 09:00–21:00 active, daily cap 2,
  inactivity 2 days, tick interval) in `lib/config` with env overrides. `learner_profile.last_active`
  (001) is the activity signal.
- **Rationale**: FR-008/011/014; deterministic, recoverable.

## D6. Decision logic is a pure function
- **Decision**: `shouldSendOutreach(now, state, cfg)` returns `{ send, type?, reason }` from: tz-local
  time vs quiet window, last_active vs inactivity threshold + "active now" guard, today's outreach
  count vs cap, due-review count, last-session date. Pure → Vitest covers quiet-hours, cap,
  activity, reminder-vs-nudge selection, and ordering.
- **Rationale**: Principle I; makes SC-002/004/005/008 testable without the network.
