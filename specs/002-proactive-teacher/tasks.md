---
description: "Task list for 002 — Proactive Teacher"
---

# Tasks: Proactive Teacher (002)

**Input**: Design documents from `specs/002-proactive-teacher/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/proactive.md
**Builds on**: 001 (engine, teacher, DB). No new dependencies.

**Tests**: INCLUDED (Principle I / FR-029). Pure logic is written test-first (red → green).

**Organization (by build layer / dependency)**: foundation (DB + config + activity tracking) → pure
core + Vitest → orchestrator (continuation) → thin Telegram client → unified internal scheduler →
polish. `[US1]` = post-action continuation; `[US2]` = scheduler-initiated outreach.

> **Post-analyze fixes applied**: (X2) T006 updates `last_active_date` on every learner message —
> outreach depends on it. (X1) T019 closes idle sessions **without** a summary (session-summary is
> 001 US2, not yet built). (X3) "active" is defined as `last_active_date == today` (tz-local) and
> drives both the active-guard and the inactivity nudge.

## Format: `[ID] [P?] [Story?] Description`

---

## Phase 1: Setup

- [X] T001 Add outreach env vars to `.env.example`: `OUTREACH_TZ`, `OUTREACH_DAILY_CAP`, `OUTREACH_INACTIVITY_DAYS`, `OUTREACH_ACTIVE_START`, `OUTREACH_ACTIVE_END`, `SCHEDULER_TICK_MIN`

---

## Phase 2: Foundational (Blocking) — DB + config + activity tracking

- [X] T002 Add `messages.telegram_message_id` (bigint, nullable) + index `messages_telegram_message_id` in `lib/db/schema.ts`
- [X] T003 Add `outreach_log` table (id, profile_id fk→learner_profile cascade, type, sent_at) + index `outreach_log_profile_sent` in `lib/db/schema.ts`
- [ ] T004 Generate the Drizzle migration into `drizzle/` (`npm run db:generate`)
- [X] T005 Add outreach config to `lib/config/constants.ts` (timezone, active window 09:00–21:00, dailyCap=2, inactivityDays=2, tickMin=15) + env overrides in `lib/config/env.ts`
- [X] T006 **(fix X2)** Update `learner_profile.last_active_date` (tz-local "today") on every inbound learner message — in `lib/orchestrator/turn.ts` (via a `store.touchLastActive(profileId)` added to `lib/orchestrator/store.ts`). Without this, the active-guard and inactivity nudge cannot work.

**Checkpoint**: schema + migration + config + activity tracking compile (`tsc`).

---

## Phase 3: Pure Core + Vitest (Layer 1) 🎯 deterministic

- [ ] T007 [P] [US2] Vitest for `shouldSendOutreach`: quiet-hours suppression, daily cap (2), active-guard (**active = last_active_date == today, X3**), reminder-vs-nudge selection, "nothing due" → no send, determinism — in `tests/outreach/decide.test.ts`
- [ ] T008 [US2] Implement `lib/outreach/decide.ts` — pure `shouldSendOutreach(now, state, cfg)` per contracts; **active iff `lastActive` is tz-local today**; inactivity nudge when `today - lastActive >= inactivityDays` — to pass T007
- [ ] T009 [P] [US2] Vitest for `buildReminder`/`buildNudge`: Arabic, grounded in due-count/focus, deterministic — in `tests/outreach/messages.test.ts`
- [ ] T010 [US2] Implement `lib/outreach/messages.ts` — pure Arabic templated reminder + nudge builders to pass T009
- [X] T011 [P] [US1] Vitest for continuation context: builds correct/incorrect Arabic teacher-context from (quiz, chosenIndex, correct); deterministic — in `tests/orchestrator/continuation-context.test.ts`
- [X] T012 [US1] Implement `lib/orchestrator/continuation-context.ts` — pure `buildContinuationContext(quiz, chosenIndex, correct)` → teacher messages to pass T011

**Checkpoint**: `npm test` green for the deterministic outreach + continuation-context core.

---

## Phase 4: Orchestrator — Continuation (Layer 2)

- [X] T013 [P] [US1] Vitest (mocked teacher) for `continueAfterQuiz`: exactly one teacher call, returns one decision, no recursion, null-fallback on failure — in `tests/orchestrator/continuation.test.ts`
- [X] T014 [US1] Implement `lib/orchestrator/continuation.ts` — `continueAfterQuiz(profileId, quiz, chosenIndex, correct)` using `buildContinuationContext` + the existing `decideTurn`/`generateTeacherDecisionRaw`; returns one `TeacherDecision | null` to pass T013

**Checkpoint**: continuation produces exactly one next-step turn under mocked AI (SC-001, SC-002).

---

## Phase 5: Thin Telegram Client (Layer 3)

- [X] T015 [US1] Extend `lib/orchestrator/store.ts`: `setTelegramMessageId(messageId, tgMessageId)` and `findMessageByTelegramId(tgMessageId)` (returns row incl. `mode_payload`)
- [X] T016 [US1] In `lib/telegram/bot.ts`, when sending a quiz card: persist the assistant message, then set its `telegram_message_id` to the sent card's id; remove the in-memory `quizStore`
- [X] T017 [US1] Rewrite the quiz callback in `lib/telegram/bot.ts`: DB lookup by `telegram_message_id` → grade (`gradeQuiz` on `mode_payload`) → reveal → `continueAfterQuiz` → send the continuation (and any next quiz card stored); if payload missing, friendly "card expired" answer (never a silent no-op) (FR-004)
- [ ] T018 [US2] Extend `lib/orchestrator/store.ts` with outreach queries: `todayOutreachCount(profileId, tz)`, `dueReviewCount(profileId)`, `lastSessionDate(profileId)`, `insertOutreachLog(profileId, type)`

**Checkpoint**: quiz answer continues live; quiz state recovers from DB (SC-003).

---

## Phase 6: Unified Internal Scheduler (Layer 4)

- [ ] T019 [US2] Implement `lib/scheduler/index.ts` — `startScheduler()` running `setInterval(tick, SCHEDULER_TICK_MIN)`; `tick()` runs each step in its own try/catch (failure isolation): (a) outreach: build state → `shouldSendOutreach` → `build{Reminder|Nudge}` → send via Telegram → `insertOutreachLog`; (b) **session-idle close WITHOUT summary** (close `sessions` idle past timeout; **(fix X1)** session-summary is deferred to 001 US2 — do NOT generate it here); (c) analysis backfill where `messages.analyzed_at IS NULL` (001 research A2); (d) SRS-due feeds outreach state
- [ ] T020 [US2] Implement `instrumentation.ts` `register()` to call `startScheduler()` once on server boot (Next instrumentation hook)
- [ ] T021 [P] [US2] Vitest (mocked deps) for the tick orchestration: one failing step does not abort the others; no send when `shouldSendOutreach` says skip — in `tests/scheduler/tick.test.ts`

**Checkpoint**: scheduler sends bounded, quiet-hours-respecting, learner-grounded outreach (SC-004/005/006/007/008).

---

## Phase 7: Polish & Deploy

- [ ] T022 Apply the new migration to Supabase via `scripts/db-setup.ts` and add the outreach env vars to the VPS `.env`
- [ ] T023 Run `quickstart.md` scenarios 1–8; confirm `npm test`, `tsc`, and `next build` green
- [ ] T024 [P] Cross-reference 001: note that T044 (scheduler), FR-031 (session-idle close — now **without** summary), and research-A2 (analysis backfill) are implemented by the 002 unified scheduler; session-summary remains 001 US2

---

## Dependencies & Execution Order
- Phase 1 → 2 block everything. T006 (last_active) is required for the outreach active-guard/nudge.
- Phase 3 pure core (no DB/AI) — parallel test→impl pairs (T007/T008, T009/T010, T011/T012).
- Phase 4 continuation needs T012 (context) + 001's `decideTurn`.
- Phase 5 needs T014 (continuation) + T002 (telegram_message_id) + T015/T018 (store).
- Phase 6 needs T008 (decide), T010 (messages), T018 (outreach queries), T006 (last_active), and
  001's session/analysis pieces for (b)/(c).
- Phase 7 after the paths exist.

### Key dependencies
- T006 (last_active) blocks T008's active-guard correctness and T019 outreach.
- T002 blocks T016/T017 (quiz recovery). T003 blocks T018/T019 (cap + logging).
- T008 + T010 block T019. T014 blocks T017.

### Parallel opportunities
- Phase 3: the three test→impl pairs. T021, T024 are independent `[P]`.

---

## Implementation Strategy

### MVP first (US1 — fix the silence)
Phases 1–2 (incl. T002, T006) → T011/T012 (continuation context) → T013/T014 (continueAfterQuiz) →
T015/T016/T017 (DB-backed quiz + continuation in the callback). **Stop and validate** quickstart
scenarios 1–3 before US2.

### Incremental delivery
1. Foundation (Phase 1–2, incl. last_active tracking).
2. + US1 (continuation + quiz recovery) → reported silence fixed (MVP).
3. + US2 pure core (decide/messages) + outreach queries.
4. + unified scheduler (outreach + idle-close-no-summary + backfill + SRS-due) + instrumentation.
5. + polish/deploy.

### Notes
- Pure modules: test before implementation; commit per task/logical pair.
- Outreach text/decision are deterministic (Principle I); continuation content is the LLM teacher.
- No pedagogy in the Telegram client (Principle VII); every Turkish form passes the 001 morphology gate.
