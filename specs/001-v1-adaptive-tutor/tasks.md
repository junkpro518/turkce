---
description: "Task list for turkce v1 — Adaptive Turkish Tutor (Telegram)"
---

# Tasks: turkce v1 — Adaptive Turkish Tutor (Telegram)

**Input**: Design documents from `specs/001-v1-adaptive-tutor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. The constitution (Principle I) and FR-029 mandate Vitest coverage for all
deterministic pedagogical logic, and FR-030 mandates an eval harness. Test tasks are first-class
here and, for pure modules, written before their implementation (red → green).

**Organization (deviation, by explicit user request)**: Tasks are ordered by **build layer /
dependency**, not grouped per user story:
DB & setup → (1) pure engine core + tests → (2) AI layers behind Zod → (3) thin Telegram client →
(4) curriculum + golden-set authoring → polish. `[US#]` labels are applied to tasks that serve a
specific user story (US1 conversation+correction, US2 adaptive backbone, US3 SRS, US4 onboarding/
progress); cross-cutting foundational/core/polish tasks carry no story label. The MVP path (US1)
is called out in Implementation Strategy.

## Format: `[ID] [P?] [Story?] Description`
- **[P]**: can run in parallel (different files, no incomplete-task dependency)
- Paths are repo-root relative, per plan.md Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization.

- [ ] T001 Initialize Next.js 15 (App Router) + TypeScript project at repo root (`package.json`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx` placeholder)
- [ ] T002 [P] Install and pin runtime deps: `next`, `ai`, an OpenRouter AI-SDK provider, `drizzle-orm`, a Postgres driver, `zod`, `grammy`, `ts-fsrs`, `nlptoolkit-morphologicalanalysis`, `nlptoolkit-spellchecker` (record versions in `package.json`)
- [ ] T003 [P] Install and configure dev deps: `vitest` + `vitest.config.ts`, ESLint + Prettier
- [ ] T004 [P] Create `.env.example` with all required vars (docs/08) and ensure `.env` is git-ignored
- [ ] T005 [P] Create the `lib/` engine folder tree, `data/`, and `tests/` per plan.md Project Structure (empty index files only)

**Checkpoint**: Project builds and `npm test` runs (no tests yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every layer depends on. **No core/AI/client work begins until done.**

- [ ] T006 Implement `lib/config/env.ts` (Zod-parsed environment) and `lib/config/constants.ts` (tunable mastery α/thresholds/min-evidence/min-sessions, demotion threshold, CEFR promotion %, idle timeout) per data-model.md
- [ ] T007 Define the Drizzle schema for all 8 tables incl. `messages.analyzed_at` and `messages.flagged` in `lib/db/schema.ts` per data-model.md
- [ ] T008 Configure `drizzle.config.ts` + DB client in `lib/db/client.ts`; generate the initial migration into `drizzle/`
- [ ] T009 [P] Implement structured logging + friendly-error helpers in `lib/config/logger.ts` (Principle IV: log technical, never surface raw)

**Checkpoint**: Migrations apply to a database; config and logging are importable.

---

## Phase 3: Pure Engine Core + Vitest (Layer 1) 🎯 deterministic backbone

**Purpose**: The deterministic, interface-agnostic modules — written test-first. These have no AI
and no transport dependency. Most are independently parallelizable.

- [ ] T010 [P] Vitest for mastery: EWMA update, status transitions (new→learning→mastered with score≥0.8 + ≥5 evidence + ≥2 sessions), demotion-harder-than-promotion, luck resistance, per-skill CEFR derivation in `tests/mastery/mastery.test.ts`
- [ ] T011 [US2] Implement `lib/mastery/` (EWMA mastery, status thresholds, per-skill CEFR derivation — all pure) to pass T010
- [ ] T012 [P] Vitest for SRS determinism: same card + rating ⇒ identical next `due_at`; state transitions in `tests/srs/srs.test.ts`
- [ ] T013 [P] [US3] Implement `lib/srs/` pure wrappers over `ts-fsrs` (rate, schedule, capture) to pass T012
- [ ] T014 [P] Vitest for curriculum next-focus selection: balances progress/weakness/active-goal, respects prerequisites, handles borderline nodes (against a fixture tree) in `tests/curriculum/select.test.ts`
- [ ] T015 [US2] Implement `lib/curriculum/` — `CurriculumNode` type, tree loader, and pure next-focus selection — to pass T014 (tree *content* authored in Phase 6)
- [ ] T016 [P] Vitest for F0.5 scorer: precision-weighted F0.5 over edit spans + overcorrection rate on correct sentences in `tests/eval/score.test.ts`
- [ ] T017 [P] Implement `lib/eval/score.ts` — pure TypeScript F0.5 + overcorrection scorer (no Python/M2/ERRANT) to pass T016
- [ ] T018 [P] Vitest for Telegram message splitting: >4096 boundaries, never drops content in `tests/telegram/split.test.ts`
- [ ] T019 [P] Implement `lib/telegram/split.ts` (pure) to pass T018
- [ ] T020 [P] Vitest for morphology gate: known-good words pass, garbage ⇒ false in `tests/morphology/isValid.test.ts`
- [ ] T021 Implement `lib/morphology/` — `FsmMorphologicalAnalyzer` startup singleton + `isValid(word)` gate; bundle the package data files (`turkish_finite_state_machine.xml`, `turkish_dictionary.txt`, `suffixes.txt`, etc.) and ensure they load at runtime cwd — to pass T020
- [ ] T022 [P] [US4] Vitest + implement `lib/progress/` pure derivation (per-skill CEFR, current focus, top weaknesses, due reviews, streak/XP) in `tests/progress/` and `lib/progress/`

**Checkpoint**: `npm test` green for the entire deterministic core (SC-005, SC-007, SC-009, SC-010).

---

## Phase 4: AI Layers Behind Zod (Layer 2)

**Purpose**: Every LLM I/O behind a Zod schema with validation + fallback (Principle I). Critical-
path calls use the strong analyzer model. Depends on Phase 3 (morphology gate, mastery, srs).

- [ ] T023 Implement `lib/ai/provider.ts` — OpenRouter provider via the AI SDK, env-driven model config (`TEACHER_MODEL`/`ANALYZER_MODEL`), temperatures, prompt caching
- [ ] T024 [P] Implement all Zod schemas (`AnalysisResult`, `OvercorrectionVerdict`, `QuizPayload`, `VocabCardBuild`, `SessionSummary`) in `lib/ai/schemas.ts` per contracts/ai-schemas.md
- [ ] T025 [US1] Implement deep-correction analyzer (`generateObject` → `AnalysisResult`) with post-parse validation (grammarPoint ∈ curriculum keys, every Turkish form via `morphology.isValid`) + empty-result fallback in `lib/analyzer/correct.ts`
- [ ] T026 [US1] Implement anti-overcorrection pass (`OvercorrectionVerdict`) gating `error_log` writes; low-confidence ⇒ tutor expresses doubt in `lib/analyzer/overcorrection.ts`
- [ ] T027 [US3] Implement vocab card building (`VocabCardBuild`) + repeated-card judge + morphology gate + unique upsert into `vocab_cards` in `lib/analyzer/cards.ts`
- [ ] T028 [US2] Implement session-summary generation (`SessionSummary`) with deterministic fallback in `lib/analyzer/summary.ts`
- [ ] T029 [US2] Implement tiered context builder (Tier 1 static + Tier 2 dynamic from the learner model) in `lib/orchestrator/context.ts`
- [ ] T030 [US1] Implement teacher call (`streamText`, mode decision, structured `QuizPayload` emission) + retry then backup-model fallback in `lib/orchestrator/teacher.ts`
- [ ] T031 [US1] Implement `orchestrator.handleTurn`: persist inbound message **first** → stream teacher reply → schedule background analysis → on completion set `messages.analyzed_at`, write `error_log`, update mastery/SRS in `lib/orchestrator/turn.ts`
- [ ] T032 [US2] Wire analyzer `masterySignals` → `lib/mastery` updates → `grammar_mastery` + periodic per-skill CEFR re-derivation in `lib/orchestrator/turn.ts`
- [ ] T033 [P] [US1] Integration test (mocked AI): reply is not blocked by analysis; message persisted before analysis; `analyzed_at` set after; analyzer failure degrades gracefully in `tests/orchestrator/turn.test.ts`

**Checkpoint**: A turn can be driven end-to-end with mocked AI (SC-002, SC-003, SC-004).

---

## Phase 5: Thin Telegram Client (Layer 3)

**Purpose**: Adapt Telegram ↔ engine. No pedagogical logic here (Principle VII). Depends on Phase 4.

- [ ] T034 [US1] Implement webhook route `app/api/telegram/route.ts` (grammY `webhookCallback`) + auth (secret-token header + `ALLOWED_TELEGRAM_USER_ID`; others ignored) per contracts/telegram-webhook.md
- [ ] T035 [US1] Implement streaming render (`editMessageText` ~1.5s + typing action) and split-message render in `lib/telegram/render.ts` (uses T019)
- [ ] T036 [US1] Implement quiz inline-keyboard render + callback grading (reveal correct/incorrect + explanation) in `lib/telegram/quiz.ts`
- [ ] T037 [US3] Implement `/review` SRS flow over Telegram (reveal → forgot/hard/good/easy → reschedule via `lib/srs`) in `lib/telegram/review.ts`
- [ ] T038 [US1] Implement 🚩 flag callback → set `messages.flagged = true` in `lib/telegram/flag.ts`
- [ ] T039 [US4] Implement `/start` onboarding + light placement (conservative A1, lowered early-evidence bar) in `lib/telegram/onboarding.ts`
- [ ] T040 [US4] Implement `/progress` command rendering `lib/progress` output in `lib/telegram/progress.ts`
- [ ] T041 [US2] Implement natural-language goal management (intent → goals add/edit/reprioritize/pause; auto-suggest requires approval) in `lib/orchestrator/goals.ts`
- [ ] T042 [US4] Implement in-process scheduler in `lib/scheduler/` — daily reminder, idle-session sweep (close + summarize via T028), SRS-due nudge, and analysis-backfill sweep (re-run analysis where `analyzed_at IS NULL`)

**Checkpoint**: Live Telegram conversation, quizzes, SRS review, progress, reminders all work.

---

## Phase 6: Curriculum & Golden-Set Authoring (Layer 4)

**Purpose**: The hand-authored, human-verified content that gates v1 (clarify decision). Depends on
the curriculum type (T015) and eval scorer (T017).

- [ ] T043 [US2] Author the full A1→A2 curriculum tree in `data/curriculum/` (grounded in docs/10 sources, rephrased not copied, prerequisites set, borderline nodes marked, required flags) per `CurriculumNode`
- [ ] T044 Validate the curriculum tree in `tests/curriculum/tree.test.ts`: unique keys, all prerequisites resolve, levels/required flags valid
- [ ] T045 [US1] Author the golden set in `data/golden/` — ≥150 hand-written A1–A2 cases (case suffixes, possessive agreement, postpositions, vowel harmony, core tenses) including 25–30% correct sentences; leakage-safe (not seeded from public GECTurk)
- [ ] T046 [P] Add a supplementary GECTurk `movie_reviews` diversity sample (apache-2.0) to `data/golden/` as a non-core supplement (clearly separated)
- [ ] T047 [US1] Implement the golden-set runner + `npm run eval` in `lib/eval/run.ts`; record the baseline F0.5 + overcorrection rate per CEFR level
- [ ] T048 Add a GitHub Actions workflow (`.github/workflows/eval.yml`) running Vitest + the eval gate on changes to teacher/analyzer prompts or model config; block on F0.5 regression or raised overcorrection (FR-030)

**Checkpoint**: Curriculum drives selection; eval baseline recorded; CI gate active (SC-001).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Reliability, deployment, and final validation.

- [ ] T049 Implement self-alert to the authorized learner on errors/outages and confirm structured logging wraps every AI call (FR-027, docs/09 Q12)
- [ ] T050 [P] Token-spend logging per turn in `lib/ai/` (docs/09 Q7/Q12)
- [ ] T051 [P] Add `Dockerfile` (Next.js standalone) ensuring morphology data files are copied into the image; add `compose.yaml`
- [ ] T052 Add a webhook-registration script (`setWebhook` with secret token, `APP_URL`) in `scripts/`
- [ ] T053 [P] Optional: periodic JSON export of learning data (docs/09 Q11) in `lib/scheduler/`
- [ ] T054 Run `quickstart.md` end-to-end validation scenarios 1–6 and confirm the v1 Definition of Done

---

## Dependencies & Execution Order

### Layer (phase) dependencies
- **Phase 1 Setup** → no deps.
- **Phase 2 Foundational** → after Setup. Blocks everything below.
- **Phase 3 Pure Core** → after Foundational. The deterministic backbone; mostly parallel.
- **Phase 4 AI/Zod** → after Phase 3 (needs morphology gate T021, mastery T011, srs T013, curriculum T015).
- **Phase 5 Telegram** → after Phase 4 (needs orchestrator T031, analyzer, schemas).
- **Phase 6 Content** → curriculum authoring (T043) unblocks real selection + needs T015; golden set + eval need T017/T047.
- **Phase 7 Polish** → after the feature paths exist.

### Key task dependencies
- T021 (morphology) blocks T025/T027 (AI must gate Turkish forms).
- T015 (curriculum type/selection) blocks T043 (authoring) and is used by T025 (grammarPoint validation).
- T031 (handleTurn) blocks T034 (webhook drives it) and depends on T029/T030.
- T028 (summary) is used by T042 (idle-session sweep).
- T047 (eval runner) depends on T017 (scorer) + T045 (golden set); T048 (CI gate) depends on T047.

### Parallel opportunities
- All `[P]` Setup tasks (T002–T005) together.
- Phase 3 is highly parallel: T010/T012/T014/T016/T018/T020/T022 (tests) and their implementations run as independent module pairs.
- T024 (schemas) parallel with T023 (provider).
- T046, T050, T051, T053 are independent `[P]` polish tasks.

---

## Parallel Example: Phase 3 (pure core)

```bash
# Independent test→impl module pairs can be built in parallel (different files):
Pair A: T010 + T011  (lib/mastery)
Pair B: T012 + T013  (lib/srs)
Pair C: T014 + T015  (lib/curriculum)
Pair D: T016 + T017  (lib/eval)
Pair E: T018 + T019  (lib/telegram/split)
Pair F: T020 + T021  (lib/morphology)
Pair G: T022        (lib/progress)
```

---

## Implementation Strategy

### MVP first (US1 — intelligent conversation with deep correction)
The thinnest valuable slice: Setup + Foundational → the pure core it needs (T020/T021 morphology,
plus message-split T018/T019) → AI layer for US1 (T023, T024, T025, T026, T030, T031, T033) →
Telegram for US1 (T034, T035, T036, T038) → a minimal golden set + eval (subset of T045/T047) to
prove correction quality. **Stop and validate** scenario 1–2 from quickstart.md before widening.

### Incremental delivery
1. Setup + Foundational + Pure Core (Phase 1–3) → deterministic backbone tested green.
2. + US1 AI & Telegram → talk + deep correction working (MVP).
3. + US2 (mastery wiring T032, context T029, goals T041, summary T028, curriculum authoring T043) → adaptation across sessions.
4. + US3 (cards T027, review T037) → SRS.
5. + US4 (onboarding T039, progress T040, scheduler T042) → engagement.
6. + Phase 6 content/eval gate + Phase 7 polish → v1 Definition of Done.

### Notes
- `[P]` = different files, no incomplete dependency.
- Pure modules: test before implementation (red → green); commit after each task or logical pair.
- Never let a client/transport task introduce pedagogical logic (Principle VII).
- Every Turkish form emitted must pass `morphology.isValid` before persistence/display (FR-008).
