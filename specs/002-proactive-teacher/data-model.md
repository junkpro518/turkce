# Phase 1 — Data Model (002)

Additive changes to 001's schema. Two migrations.

## Schema changes

### `messages` — add one column (quiz recovery, FR-004)
| column | type | notes |
|--------|------|-------|
| `telegram_message_id` | bigint | nullable — the Telegram message id of a sent quiz card; lets the quiz callback recover the persisted `mode_payload` and grade across restarts |

Index: `messages_telegram_message_id` on `telegram_message_id` (lookup on callback).

### `outreach_log` — new table (cap / dedup / recovery, FR-008/011)
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `profile_id` | uuid | fk → learner_profile (cascade) |
| `type` | text | `reminder` \| `nudge` |
| `sent_at` | timestamptz | default now() |

Index: `outreach_log_profile_sent` on `(profile_id, sent_at)` — used to count today's sends.

## Config (lib/config — constants + env overrides)
| key | default | env override |
|-----|---------|--------------|
| timezone | (set per deploy) | `OUTREACH_TZ` |
| quiet window (active hours) | 09:00–21:00 | `OUTREACH_ACTIVE_START` / `_END` |
| daily proactive cap | 2 | `OUTREACH_DAILY_CAP` |
| inactivity threshold | 2 days | `OUTREACH_INACTIVITY_DAYS` |
| scheduler tick interval | 15 min | `SCHEDULER_TICK_MIN` |

## Derived state for the decision (read, not stored)
- `lastActive` ← `learner_profile.last_active_date` (001).
- `dueReviewCount` ← count of `vocab_cards` with `due_at <= now`.
- `lastSessionDate` ← latest `sessions.started_at`.
- `todayOutreachCount` ← count of `outreach_log` rows for today (tz-local).

## Validation / invariants (pure, tested)
- `shouldSendOutreach` is a pure function of `(now, {lastActive, dueReviewCount, lastSessionDate,
  todayOutreachCount}, cfg)`; identical inputs → identical decision.
- Daily cap: never emit when `todayOutreachCount >= cap`.
- Quiet hours: never emit when tz-local time is outside the active window.
- Active guard: never emit when the learner was active within the activity window.
- Quiz grading reads only DB state (no in-memory dependency).
