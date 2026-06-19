---
description: "Task list for 002 — Proactive Teacher"
---

# Tasks: Proactive Teacher (002)

**Input**: Design documents from `specs/002-proactive-teacher/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/proactive.md
**Builds on**: 001 (engine, teacher, scheduler-to-be, DB). No new dependencies.

**Tests**: INCLUDED (Principle I / FR-029). Pure logic is written test-first (red → green).

**Organization (by build layer / dependency, per user request)**: foundation (DB + config) → pure
core + Vitest → orchestrator (continuation) → thin Telegram client → unified internal scheduler →
polish. `[US1]` = post-action continuation; `[US2]` = scheduler-initiated outreach. Cross-cutting/
foundational/polish tasks carry no story label.

## Format: `[ID] [P?] [Story?] Description`

---

## Phase 1: Setup

- [ ] T001 Add outreach env vars to `.env.example`: `OUTREACH_TZ`, `OUTREACH_DAILY_CAP`, `OUTREACH_INACTIVITY_DAYS`, `OUTREACH_ACTIVE_START`, `OUTREACH_ACTIVE_END`, `SCHEDULER_TICK_MIN`

---

## Phase 2: Foundational (Blocking) — DB + config

- [ ] T002 Add `messages.telegram_message_id` (bigint, nullable) + index `messages_telegram_message_id` in `lib/db/schema.ts` (data-model.md)
- [ ] T003 Add `outreach_log` table (id, profile_id fk→learner_profile cascade, type, sent_at) + index `outreach_log_profile_sent` in `lib/db/schema.ts`
- [ ] T004 Generate the Drizzle migration into `drizzle/` (`npm run db:generate`)
- [ ] T005 Add outreach config to `lib/config/constants.ts` (timezone, active window 09:00–21:00, dailyCap=2, inactivityDays=2, tickMin=15) and env overrides in `lib/config/env.ts`

**Checkpoint**: schema + migration + config compile (`tsc`); no logic yet.

---

## Phase 3: Pure Core + Vitest (Layer 1) 🎯 deterministic

- [ ] T006 [P] [US2] Vitest for `shouldSendOutreach`: quiet-hours suppression, daily cap (2), active-guard, reminder-vs-nudge selection, "nothing due" → no send, determinism — in `tests/outreach/decide.test.ts`
- [ ] T007 [US2] Implement `lib/outreach/decide.ts` — pure `shouldSendOutreach(now, state, cfg)` per contracts (tz-local quiet window → active guard → cap → type select) to pass T006
- [ ] T008 [P] [US2] Vitest for `buildReminder`/`buildNudge`: Arabic, grounded in due-count/focus, deterministic — in `tests/outreach/messages.test.ts`
- [ ] T009 [US2] Implement `lib/outreach/messages.ts` — pure Arabic templated reminder + nudge builders to pass T008
- [ ] T010 [P] [US1] Vitest for continuation context: builds correct/incorrect Arabic teacher-context from (quiz, chosenIndex, correct); deterministic — in `tests/orchestrator/continuation-context.test.ts`
- [ ] T011 [US1] Implement `lib/orchestrator/continuation-context.ts` — pure `buildContinuationContext(quiz, chosenIndex, correct)` → teacher messages to pass T010

**Checkpoint**: `npm test` green for the deterministic outreach + continuation-context core.

---

## Phase 4: Orchestrator — Continuation (Layer 2)

- [ ] T012 [P] [US1] Vitest (mocked teacher) for `continueAfterQuiz`: exactly one teacher call, returns one decision, no recursion, null-fallback on failure — in `tests/orchestrator/continuation.test.ts`
- [ ] T013 [US1] Implement `lib/orchestrator/continuation.ts` — `continueAfterQuiz(profileId, quiz, chosenIndex, correct)` using `buildContinuationContext` + the existing `decideTurn`/`generateTeacherDecisionRaw` (Arabic, level-scaled); returns one `TeacherDecision | null` to pass T012

**Checkpoint**: continuation produces exactly one next-step turn under mocked AI (SC-001, SC-002).

---

## Phase 5: Thin Telegram Client (Layer 3)

- [ ] T014 [US1] Extend `lib/orchestrator/store.ts`: `setTelegramMessageId(messageId, tgMessageId)` and `findMessageByTelegramId(tgMessageId)` (returns row incl. `mode_payload`)
- [ ] T015 [US1] In `lib/telegram/bot.ts`, when sending a quiz card: persist the assistant message, then set its `telegram_message_id` to the sent card's id; remove the in-memory `quizStore`
- [ ] T016 [US1] Rewrite the quiz callback in `lib/telegram/bot.ts`: DB lookup by `telegram_message_id` → grade (`gradeQuiz` on `mode_payload`) → reveal → `continueAfterQuiz` → send the continuation (and next quiz card stored); if payload missing, friendly "card expired" answer (never a silent no-op) (FR-004)
- [ ] T017 [US2] Extend `lib/orchestrator/store.ts` with outreach queries: `todayOutreachCount(profileId, tz)`, `dueReviewCount(profileId)`, `lastSessionDate(profileId)`, `insertOutreachLog(profileId, type)`

**Checkpoint**: quiz answer continues live; quiz state recovers from DB (SC-003).

---

## Phase 6: Unified Internal Scheduler (Layer 4)

- [ ] T018 [US2] Implement `lib/scheduler/index.ts` — `startScheduler()` running `setInterval(tick, SCHEDULER_TICK_MIN)`; `tick()` runs, each in its own try/catch (failure isolation): (a) outreach: build state → `shouldSendOutreach` → `build{Reminder|Nudge}` → send via Telegram → `insertOutreachLog`; (b) session-idle close + summary (001 FR-031); (c) analysis backfill where `messages.analyzed_at IS NULL` (001 research A2); (d) SRS-due feeds outreach state
- [ ] T019 [US2] Implement `instrumentation.ts` `register()` to call `startScheduler()` once on server boot (Next instrumentation hook)
- [ ] T020 [P] [US2] Vitest (mocked deps) for the tick orchestration: one failing step does not abort the others; no send when `shouldSendOutreach` says skip — in `tests/scheduler/tick.test.ts`

**Checkpoint**: scheduler sends bounded, quiet-hours-respecting, learner-grounded outreach (SC-004/005/006/007/008).

---

## Phase 7: Polish & Deploy

- [ ] T021 Apply the new migration to Supabase via `scripts/db-setup.ts` and add the outreach env vars to the VPS `.env`
- [ ] T022 Run `quickstart.md` scenarios 1–8; confirm `npm test`, `tsc`, and `next build` green
- [ ] T023 [P] Cross-reference 001: note that T044 (scheduler), FR-031 (session-idle close), and research-A2 (analysis backfill) are now implemented by the 002 unified scheduler

---

## Dependencies & Execution Order
- Phase 1 → 2 (config + schema/migration) block everything.
- Phase 3 pure core (no DB/AI) — parallel test→impl pairs (T006/T007, T008/T009, T010/T011).
- Phase 4 continuation needs T011 (context) + 001's `decideTurn`.
- Phase 5 Telegram needs T013 (continuation) + T002 (telegram_message_id) + T014/T017 (store).
- Phase 6 scheduler needs T007 (decide), T009 (messages), T017 (outreach queries), and 001's
  session/analysis pieces for (b)/(c).
- Phase 7 after the paths exist.

### Key dependencies
- T002 (telegram_message_id) blocks T015/T016 (quiz recovery).
- T003 (outreach_log) blocks T017/T018 (cap + logging).
- T007 + T009 block T018 (scheduler uses them).
- T013 blocks T016 (callback continuation).

### Parallel opportunities
- Phase 3: the three test→impl pairs run independently.
- T020, T023 are independent `[P]`.

---

## Implementation Strategy

### MVP first (US1 — fix the silence)
Phases 1–2 (schema/config) → T010/T011 (continuation context) → T012/T013 (continueAfterQuiz) →
T014/T015/T016 (DB-backed quiz + continuation in the callback). **Stop and validate** quickstart
scenarios 1–3 (continue after answer + survives restart) before US2.

### Incremental delivery
1. Foundation (Phase 1–2).
2. + US1 (continuation + quiz recovery) → the reported silence is fixed (MVP).
3. + US2 pure core (decide/messages) + outreach queries.
4. + the unified scheduler (outreach + idle-close + backfill + SRS-due) + instrumentation.
5. + polish/deploy.

### Notes
- Pure modules: test before implementation; commit per task/logical pair.
- Outreach text/decision are deterministic (Principle I); continuation content is the LLM teacher.
- No pedagogy in the Telegram client (Principle VII). Every Turkish form still passes the 001
  morphology gate.
