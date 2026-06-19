# Contracts (002) — Proactive Teacher

Pure-function and flow contracts. Documented as shapes; implemented after `tasks`.

## 1. Outreach decision (pure) — `lib/outreach/decide.ts`
```
OutreachState {
  lastActive: Date | null
  dueReviewCount: number
  lastSessionDate: Date | null
  todayOutreachCount: number
}
OutreachConfig { timezone, activeStartHour, activeEndHour, dailyCap, inactivityDays }

OutreachDecision { send: boolean; type?: "reminder" | "nudge"; reason: string }

shouldSendOutreach(now: Date, state: OutreachState, cfg: OutreachConfig): OutreachDecision
```
Order of checks (all must pass to send):
1. tz-local(now) within [activeStartHour, activeEndHour) — else `{send:false, reason:"quiet-hours"}`.
2. learner not active today — i.e. `lastActive` is NOT tz-local today (X3) — else `reason:"active"`.
3. todayOutreachCount < dailyCap — else `reason:"cap-reached"`.
4. select type: `nudge` if `today - lastActive >= inactivityDays`; else `reminder` if
   dueReviewCount > 0 or no session today; else `{send:false, reason:"nothing-due"}`.

> `lastActive` is `learner_profile.last_active_date`, updated to tz-local today on every inbound
> learner message (X2; tasks T006). "active" = `lastActive == today`.

## 2. Outreach messages (pure) — `lib/outreach/messages.ts`
```
buildReminder(state): string   // Arabic, grounded: due count / current focus
buildNudge(state): string      // Arabic, gentle re-engagement
```
Both Arabic, level-neutral-friendly; deterministic given state.

## 3. Continuation (reuses the teacher) — `lib/orchestrator/continuation.ts`
```
continueAfterQuiz(profileId, quiz, chosenIndex, correct): Promise<TeacherDecision | null>
```
- Builds a teacher prompt context: "the learner just answered quiz «…» — {correct|incorrect}".
- Calls the existing `decideTurn` / `generateTeacherDecisionRaw` (Arabic, level-scaled).
- Returns one decision (reply, optional next quiz). Caller sends it + persists as an assistant
  message. MUST NOT recurse. Fallback: null → friendly short message.

## 4. Quiz callback (DB-backed) — `lib/telegram/bot.ts`
```
on quiz:<idx> →
  msgRow = store.findMessageByTelegramId(callback.message.message_id)
  if !msgRow?.mode_payload → answerCallbackQuery (friendly "انتهت صلاحية البطاقة")   // no dead silence
  grade = gradeQuiz(msgRow.mode_payload, idx); reveal (edit message)
  decision = continueAfterQuiz(profileId, quiz, idx, grade.correct)
  send decision.reply (+ next quiz card, storing its telegram_message_id)
```
On sending any quiz card, persist the assistant message AND set `telegram_message_id` to the sent
card's id (store.setTelegramMessageId).

## 5. Scheduler tick — `lib/scheduler/index.ts`
```
startScheduler(): void   // setInterval(tick, SCHEDULER_TICK_MIN); started by instrumentation.register()
tick():
  for the single profile:
    - session-idle close WITHOUT summary (001 FR-031; X1 — session-summary is 001 US2, deferred)
    - analysis backfill: re-run analysis where messages.analyzed_at IS NULL (001 research A2)
    - SRS-due check feeds outreach state
    - decision = shouldSendOutreach(now, state, cfg)
    - if decision.send: send build{Reminder|Nudge}(state); insert outreach_log row
  every step wrapped in try/catch + logging; one failure never aborts the tick or others.
```

## Fallbacks (Principle IV)
- Stale/absent quiz payload → friendly "card expired" answer, never a silent no-op.
- Continuation LLM failure → null → a short friendly Arabic message; reveal already delivered.
- Outreach send failure → logged; `outreach_log` only written on success (so it retries next tick
  within the cap); scheduler continues.
