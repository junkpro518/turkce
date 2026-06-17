# Phase 1 — Data Model

PostgreSQL (Supabase) via Drizzle ORM. Single-user app, but the schema models one user cleanly
(everything fans out from `learner_profile`). Grounded in docs/02, with two plan-level additions
called out below. All timestamps are `timestamptz`; all ids are `uuid` (default `gen_random_uuid()`).

> **Plan-level additions beyond docs/02** (both required by Phase-0 decisions):
> 1. `messages.analyzed_at` (nullable) — drives the analysis-backfill recovery sweep (Principle IV / research A2).
> 2. `messages.flagged` (bool) — the learner's 🚩 on a suspected bad correction (FR-010), feeding the eval flywheel.

## Tables

### 1. `learner_profile` — the learner (root)
| column | type | constraints / notes |
|--------|------|---------------------|
| `id` | uuid | pk |
| `telegram_user_id` | bigint | unique, not null — the authorized user (FR-028) |
| `cefr_overall` | text | A1–C2 (enum-checked) |
| `cefr_by_skill` | jsonb | `{speaking,listening,reading,writing,grammar,vocab}` → CEFR each |
| `settings` | jsonb | `{language_mix, correction_strictness, response_style, focus_areas[], custom_instructions}` — config/seed-provided in v1 (FR-025) |
| `xp` | int | default 0 |
| `streak_days` | int | default 0 |
| `last_active_date` | date | nullable |
| `created_at` / `updated_at` | timestamptz | defaults now() |

### 2. `goals` — changeable, prioritized objectives
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `profile_id` | uuid | fk → learner_profile, not null |
| `title` | text | not null |
| `priority` | int | lower = higher priority |
| `status` | text | `active` \| `paused` \| `done` |
| `is_auto` | bool | tutor-proposed (needs approval) vs. learner-set (FR-016) |
| `created_at` | timestamptz | |

Managed via natural-language conversation in v1 (no goal commands).

### 3. `grammar_mastery` — mastery map (drives curriculum + correction depth)
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `profile_id` | uuid | fk → learner_profile, not null |
| `grammar_point` | text | key from the fixed curriculum taxonomy |
| `mastery_score` | real | 0–1, EWMA (Q4) |
| `evidence_count` | int | correct-usage evidences |
| `sessions_seen` | int | distinct sessions with evidence (plan addition — enforces the ≥2-session mastery rule, Q4) |
| `status` | text | `new` \| `learning` \| `mastered` |
| `last_seen_at` | timestamptz | |
| — | — | unique `(profile_id, grammar_point)` |

### 4. `vocab_cards` — vocabulary + FSRS state
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `profile_id` | uuid | fk → learner_profile, not null |
| `word` | text | not null |
| `translation` | text | |
| `example` | text | |
| `pos` | text | part of speech |
| `stability` / `difficulty` | real | FSRS |
| `due_at` | timestamptz | next review due |
| `reps` / `lapses` | int | FSRS |
| `state` | text | FSRS state (new/learning/review/relearning) |
| `source_message_id` | uuid | fk → messages, nullable |
| `created_at` | timestamptz | |
| — | — | unique `(profile_id, word)` (FR-018 no duplicates) |

### 5. `sessions` — learning sessions (idle-bounded)
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `profile_id` | uuid | fk → learner_profile, not null |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | nullable; set when idle-closed (FR-031) |
| `current_focus` | text | curriculum focus key at the time |
| `summary_id` | uuid | fk → session_summaries, nullable |

A session is open while `ended_at IS NULL`. Closed (with summary) by idle timeout — lazily on the
next message or by the scheduler sweep (research A2).

### 6. `messages` — conversation turns
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `session_id` | uuid | fk → sessions (cascade delete), not null |
| `role` | text | `user` \| `assistant` |
| `content` | text | not null |
| `mode` | text | `discuss`\|`answer`\|`quiz`\|`story`\|`roleplay`\|`drill` (assistant turns) |
| `mode_payload` | jsonb | structured quiz data etc. (inline, no separate table) |
| `analyzed_at` | timestamptz | **nullable** — null = pending analysis (backfill target) |
| `flagged` | bool | **default false** — learner 🚩 on a bad correction (FR-010) |
| `created_at` | timestamptz | |
| — | — | index `(session_id, created_at)` |

### 7. `error_log` — deep-correction record
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `message_id` | uuid | fk → messages (cascade delete), not null |
| `grammar_point` | text | from the taxonomy |
| `original` | text | the learner's form |
| `correction` | text | corrected form |
| `explanation` | text | the *why* (rule) — FR-007 |
| `severity` | text | e.g. low/medium/high |
| `created_at` | timestamptz | |

### 8. `session_summaries` — long-term memory
| column | type | notes |
|--------|------|-------|
| `id` | uuid | pk |
| `session_id` | uuid | fk → sessions (cascade delete), unique |
| `summary` | text | |
| `topics` | text[] | |
| `vocab_introduced` | text[] | |
| `errors` | text[] | |
| `created_at` | timestamptz | |

## Relationships & deletes

```
learner_profile (1) ─┬─ (N) goals
                     ├─ (N) grammar_mastery
                     ├─ (N) vocab_cards
                     └─ (N) sessions ─┬─ (N) messages ── (N) error_log
                                      └─ (1) session_summaries
```

Cascade deletes: `sessions` → `messages` → `error_log`; `sessions` → `session_summaries`.

## Reference data — NOT in the database

### Curriculum skill tree (`data/curriculum/`, A1→A2)
Versioned in code, not a DB table (docs/02 decision). Shape per node:

```
CurriculumNode {
  key: string                 // stable id, also used as grammar_mastery.grammar_point
  level: "A1" | "A2"
  borderline: boolean         // contested CEFR placement (docs/10)
  grammarPoint: string        // human label
  canDo: string               // functional competency (e.g. "order food")
  targetVocab: string[]
  prerequisites: string[]     // keys of nodes that must precede this
  required: boolean           // counts toward CEFR derivation vs. optional/borderline
}
```

The set of node `key`s defines the taxonomy that `grammar_mastery.grammar_point` and the analyzer's
`grammarPoint` outputs are validated against.

### Tunable constants (`config/`)
Mastery `α` (≈0.3), mastery threshold (0.8) + min evidence (~5) + min sessions (2), demotion
threshold (0.6), per-skill CEFR promotion percentage (X%), idle-session timeout (~30 min),
cold-start lowered early-evidence bar. All tunable; covered by Vitest scenarios (Q4).

## Validation rules (enforced in pure code, tested)

- `grammar_mastery.grammar_point` and analyzer `grammarPoint` MUST be a known curriculum node key.
- Mastery transitions follow Q4 exactly (promotion needs score + evidence + ≥2 sessions; demotion
  harder).
- `vocab_cards` unique per `(profile_id, word)`; FSRS fields only mutated by the SRS module.
- Every Turkish string written to `vocab_cards`/`error_log.correction`/quiz payloads MUST have
  passed `morphology.isValid` (FR-008) before persistence.
- A session has at most one open instance (`ended_at IS NULL`) per profile.
