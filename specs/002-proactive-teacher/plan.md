# Implementation Plan: Proactive Teacher

**Branch**: `002-proactive-teacher` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-proactive-teacher/spec.md`

## Summary

Make the tutor proactive in two ways, reusing 001's engine. **(US1)** After a quiz answer the
quiz callback deterministically continues: grade + reveal, then one teacher-judged next-step turn
(reusing the existing structured teacher), persisted like any assistant message — never silent, no
self-talk loop. Quiz grading moves from volatile in-memory state to a **DB-backed lookup** (store
the Telegram message id on the message row) so answers grade across restarts. **(US2)** A single
**in-process scheduler** (implementing 001's deferred US4/T044 + FR-031 idle close + research-A2
analysis backfill, plus this feature's outreach) periodically evaluates **deterministic** outreach:
a daily reminder and a 2-day inactivity nudge, grounded in the learner model, capped at 2/day,
suppressed during quiet hours (timezone-aware) and while the learner is active. Outreach decisions
and message text are pure, tested functions (a support system → deterministic, Principle I); the
continuation content is the LLM teacher.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 22; Next.js 16 (App Router) — same as 001.

**Primary Dependencies**: existing only (grammY, drizzle-orm, ai SDK + OpenRouter, zod, ts-fsrs).
**No new dependencies.** The in-process scheduler uses `setInterval` started via Next's
`instrumentation.ts` `register()` hook (no external queue/cron infra).

**Storage**: Postgres (Supabase) via Drizzle. Two additive migrations: `messages.telegram_message_id`
(quiz recovery) and a new `outreach_log` table (cap/dedup/recovery).

**Testing**: Vitest for the deterministic core (outreach decision, message builders, continuation
trigger logic); the scheduler timer + Telegram sends are thin shells (build/integration-verified).

**Target Platform**: the existing long-lived Node server (Next standalone, Docker/VPS). The
scheduler runs in that single process (single instance → no double-fire).

**Performance/Cost**: scheduler tick every ~15 min; quiet-hours + cap + activity gating bound work
and messages. Outreach text is deterministic (no LLM cost); only US1 continuation calls the teacher.

**Constraints**: single authorized user; Arabic-dominant level-scaled language (001 prompts) for
the continuation; deterministic Arabic templates for outreach; no nagging (cap 2/day, quiet hours,
respect activity).

**Scale/Scope**: one learner; two added tables/columns; one scheduler.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

| Principle | How this design satisfies it | Status |
|-----------|------------------------------|--------|
| **I. Intelligence in conversation, determinism in support** | Outreach is a *support* function → **deterministic** pure functions (`shouldSendOutreach`, message builders) with Vitest. The *continuation* is conversation → the existing structured teacher (Zod). | ✅ Pass |
| **II. Depth before breadth** | Focused feature; reuses 001 engine; no speculative scope. Implements the already-planned scheduler rather than new infra. | ✅ Pass |
| **III. Spec Kit only path** | specify→clarify→plan→tasks; no code before approved tasks. | ✅ Pass |
| **IV. No lost state / no silent failure** | Quiz state DB-backed (survives restart); `outreach_log` enforces caps + recovers across restart; every proactive send + the scheduler tick wrapped with logging + friendly fallback; a failed send never crashes the scheduler. | ✅ Pass |
| **V. Teacher correctness** | Continuation reuses the teacher path (Arabic, level-scaled) and the same morphology/overcorrection gates for any Turkish it emits. | ✅ Pass |
| **VI. Curriculum grounded** | N/A (no curriculum authoring). | ✅ Pass |
| **VII. Single TS, engine/client split** | Decision + text logic in `lib/` (pure, interface-agnostic); the timer and Telegram I/O are a thin shell. | ✅ Pass |

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

```text
specs/002-proactive-teacher/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (outreach + continuation + scheduler shapes)
└── checklists/requirements.md
```

Source (extends 001 layout):

```text
lib/
├── outreach/                 # NEW — pure decision + Arabic message builders (Vitest)
│   ├── decide.ts             # shouldSendOutreach(now, state, cfg) → decision (PURE)
│   └── messages.ts           # buildReminder/buildNudge (PURE, Arabic, learner-grounded)
├── scheduler/                # NEW — in-process tick shell: outreach + idle-close + SRS-due + backfill
│   └── index.ts              # startScheduler() (timer + I/O; thin)
├── orchestrator/
│   ├── continuation.ts       # NEW — post-quiz continuation (reuses the structured teacher)
│   └── store.ts              # + telegram_message_id write/lookup, outreach_log queries, due/last-session counts
├── db/schema.ts              # + messages.telegram_message_id, + outreach_log table
└── telegram/
    └── bot.ts                # quiz callback: DB lookup grade → reveal → continuation; send + record outreach
instrumentation.ts            # NEW — Next register() starts the scheduler once on server boot
drizzle/                      # + migration(s)
tests/outreach/ , tests/orchestrator/continuation*  # NEW Vitest
```

**Structure Decision**: Reuse 001's single-project layout. New pure logic under `lib/outreach`
and a `lib/scheduler` shell; the only client touch is the quiz-callback continuation in `bot.ts`.
Pedagogy/decision logic stays out of the client (Principle VII).

## Complexity Tracking

> No Constitution Check violations. Intentionally empty.
