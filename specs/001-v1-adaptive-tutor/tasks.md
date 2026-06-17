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

> **Post-analyze fixes applied**: (I1) T010 authors the A1 grammar-point **key skeleton** early so
> the curriculum-selection and analyzer-validation layers have real taxonomy keys before Phase 6;
> T027 tolerates an unknown key (logs, does not hard-fail) during the partial-taxonomy window.
> (U1) T011 explicitly seeds default tutor settings.

## Format: `[ID] [P?] [Story?] Description`
- **[P]**: can run in parallel (different files, no incomplete-task dependency)
- Paths are repo-root relative, per plan.md Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization.

- [X] T001 Initialize Next.js 15 (App Router) + TypeScript project at repo root (`package.json`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx` placeholder)
- [X] T002 [P] Install and pin runtime deps: `next`, `ai`, an OpenRouter AI-SDK provider, `drizzle-orm`, a Postgres driver, `zod`, `grammy`, `ts-fsrs`, `nlptoolkit-morphologicalanalysis`, `nlptoolkit-spellchecker` (record versions in `package.json`)
- [X] T003 [P] Install and configure dev deps: `vitest` + `vitest.config.ts`, ESLint + Prettier
- [X] T004 [P] Create `.env.example` with all required vars (docs/08) and ensure `.env` is git-ignored
- [X] T005 [P] Create the `lib/` engine folder tree, `data/`, and `tests/` per plan.md Project Structure (empty index files only)

**Checkpoint**: Project builds and `npm test` runs (no tests yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every layer depends on. **No core/AI/client work begins until done.**

- [X] T006 Implement `lib/config/env.ts` (Zod-parsed environment) and `lib/config/constants.ts` (tunable mastery α/thresholds/min-evidence/min-sessions, demotion threshold, CEFR promotion %, idle timeout) per data-model.md
- [X] T007 Define the Drizzle schema for all 8 tables incl. `messages.analyzed_at` and `messages.flagged` in `lib/db/schema.ts` per data-model.md
- [X] T008 Configure `drizzle.config.ts` + DB client in `lib/db/client.ts`; generate the initial migration into `drizzle/`
- [X] T009 [P] Implement structured logging + friendly-error helpers in `lib/config/logger.ts` (Principle IV: log technical, never surface raw)
- [X] T010 **(fix I1)** Author the **A1 grammar-point key skeleton** in `data/curriculum/keys.ts` — the stable node `key`s with `level`, `prerequisites`, and `required`/`borderline` flags only (NO full `canDo`/`targetVocab` yet), grounded in docs/10. This is the taxonomy that curriculum selection (T017) and analyzer grammarPoint validation (T027) reference before full authoring (T045)
- [X] T011 **(fix U1)** Implement default tutor settings: define defaults in `lib/config/settings.ts` (language_mix, correction_strictness, response_style, focus_areas, custom_instructions) and a seed step in `lib/db/seed.ts` that writes them into `learner_profile.settings` (FR-025)

**Checkpoint**: Migrations apply; config, logging, the A1 taxonomy keys, and default settings exist.

---

## Phase 3: Pure Engine Core + Vitest (Layer 1) 🎯 deterministic backbone

**Purpose**: The deterministic, interface-agnostic modules — written test-first. No AI, no
transport dependency. Most are independently parallelizable.

- [X] T012 [P] Vitest for mastery: EWMA update, status transitions (new→learning→mastered with score≥0.8 + ≥5 evidence + ≥2 sessions), demotion-harder-than-promotion, luck resistance, per-skill CEFR derivation in `tests/mastery/mastery.test.ts`
- [X] T013 [US2] Implement `lib/mastery/` (EWMA mastery, status thresholds, per-skill CEFR derivation — all pure) to pass T012
- [X] T014 [P] Vitest for SRS determinism: same card + rating ⇒ identical next `due_at`; state transitions in `tests/srs/srs.test.ts`
- [X] T015 [P] [US3] Implement `lib/srs/` pure wrappers over `ts-fsrs` (rate, schedule, capture) to pass T014
- [X] T016 [P] Vitest for curriculum next-focus selection: balances progress/weakness/active-goal, respects prerequisites, handles borderline nodes (against the T010 key skeleton) in `tests/curriculum/select.test.ts`
- [X] T017 [US2] Implement `lib/curriculum/` — `CurriculumNode` type, tree loader, and pure next-focus selection — to pass T016 (uses the T010 A1 keys; full A1→A2 content authored in T045)
- [X] T018 [P] Vitest for F0.5 scorer: precision-weighted F0.5 over edit spans + overcorrection rate on correct sentences in `tests/eval/score.test.ts`
- [X] T019 [P] Implement `lib/eval/score.ts` — pure TypeScript F0.5 + overcorrection scorer (no Python/M2/ERRANT) to pass T018
- [X] T020 [P] Vitest for Telegram message splitting: >4096 boundaries, never drops content in `tests/telegram/split.test.ts`
- [X] T021 [P] Implement `lib/telegram/split.ts` (pure) to pass T020
- [X] T022 [P] Vitest for morphology gate: known-good words pass, garbage ⇒ false in `tests/morphology/isValid.test.ts`
- [X] T023 Implement `lib/morphology/` — `FsmMorphologicalAnalyzer` startup singleton + `isValid(word)` gate; bundle the package data files (`turkish_finite_state_machine.xml`, `turkish_dictionary.txt`, `suffixes.txt`, etc.) and ensure they load at runtime cwd — to pass T022
- [X] T024 [P] [US4] Vitest + implement `lib/progress/` pure derivation (per-skill CEFR, current focus, top weaknesses, due reviews, streak/XP) in `tests/progress/` and `lib/progress/`

**Checkpoint**: `npm test` green for the entire deterministic core (SC-005, SC-007, SC-009, SC-010).

---

## Phase 4: AI Layers Behind Zod (Layer 2)

**Purpose**: Every LLM I/O behind a Zod schema with validation + fallback (Principle I). Critical-
path calls use the strong analyzer model. Depends on Phase 3 (morphology gate, mastery, srs,
curriculum keys).

- [X] T025 Implement `lib/ai/provider.ts` — OpenRouter provider via the AI SDK, env-driven model config (`TEACHER_MODEL`/`ANALYZER_MODEL`), temperatures, prompt caching
- [X] T026 [P] Implement all Zod schemas (`AnalysisResult`, `OvercorrectionVerdict`, `QuizPayload`, `VocabCardBuild`, `SessionSummary`) in `lib/ai/schemas.ts` per contracts/ai-schemas.md
- [X] T027 [US1] Implement deep-correction analyzer (`generateObject` → `AnalysisResult`) with post-parse validation: every Turkish form via `morphology.isValid`; `grammarPoint` checked against curriculum keys — **(fix I1)** an unknown key is **tolerated (kept + logged via T009 logger), not hard-failed**, during the partial-taxonomy window; empty-result fallback — in `lib/analyzer/correct.ts`
- [X] T028 [US1] Implement anti-overcorrection pass (`OvercorrectionVerdict`) gating `error_log` writes; low-confidence ⇒ tutor expresses doubt in `lib/analyzer/overcorrection.ts`
- [ ] T029 [US3] Implement vocab card building (`VocabCardBuild`) + repeated-card judge + morphology gate + unique upsert into `vocab_cards` in `lib/analyzer/cards.ts`
- [ ] T030 [US2] Implement session-summary generation (`SessionSummary`) with deterministic fallback in `lib/analyzer/summary.ts`
- [ ] T031 [US2] Implement tiered context builder (Tier 1 static incl. seeded settings from T011 + Tier 2 dynamic from the learner model) in `lib/orchestrator/context.ts`
- [X] T032 [US1] Implement teacher call (`streamText`, mode decision, structured `QuizPayload` emission) + retry then backup-model fallback in `lib/orchestrator/teacher.ts`
- [X] T033 [US1] Implement `orchestrator.handleTurn`: persist inbound message **first** → stream teacher reply → schedule background analysis → on completion set `messages.analyzed_at`, write `error_log`, update mastery/SRS in `lib/orchestrator/turn.ts`
- [ ] T034 [US2] Wire analyzer `masterySignals` → `lib/mastery` updates → `grammar_mastery` + periodic per-skill CEFR re-derivation in `lib/orchestrator/turn.ts`
- [X] T035 [P] [US1] Integration test (mocked AI): reply not blocked by analysis; message persisted before analysis; `analyzed_at` set after; analyzer failure degrades gracefully in `tests/orchestrator/turn.test.ts`

**Checkpoint**: A turn can be driven end-to-end with mocked AI (SC-002, SC-003, SC-004).

---

## Phase 5: Thin Telegram Client (Layer 3)

**Purpose**: Adapt Telegram ↔ engine. No pedagogical logic here (Principle VII). Depends on Phase 4.

- [X] T036 [US1] Implement webhook route `app/api/telegram/route.ts` (grammY `webhookCallback`) + auth (secret-token header + `ALLOWED_TELEGRAM_USER_ID`; others ignored) per contracts/telegram-webhook.md
- [X] T037 [US1] Implement streaming render (`editMessageText` ~1.5s + typing action) and split-message render in `lib/telegram/render.ts` (uses T021)
- [X] T038 [US1] Implement quiz inline-keyboard render + callback grading (reveal correct/incorrect + explanation) in `lib/telegram/quiz.ts`
- [ ] T039 [US3] Implement `/review` SRS flow over Telegram (reveal → forgot/hard/good/easy → reschedule via `lib/srs`) in `lib/telegram/review.ts`
- [X] T040 [US1] Implement 🚩 flag callback → set `messages.flagged = true` in `lib/telegram/flag.ts`
- [ ] T041 [US4] Implement `/start` onboarding + light placement (conservative A1, lowered early-evidence bar; creates the profile, then T011 settings defaults apply) in `lib/telegram/onboarding.ts`
- [ ] T042 [US4] Implement `/progress` command rendering `lib/progress` output in `lib/telegram/progress.ts`
- [ ] T043 [US2] Implement natural-language goal management (intent → goals add/edit/reprioritize/pause; auto-suggest requires approval) in `lib/orchestrator/goals.ts`
- [ ] T044 [US4] Implement in-process scheduler in `lib/scheduler/` — daily reminder, idle-session sweep (close + summarize via T030), SRS-due nudge, and analysis-backfill sweep (re-run analysis where `analyzed_at IS NULL`)

**Checkpoint**: Live Telegram conversation, quizzes, SRS review, progress, reminders all work.

---

## Phase 6: Curriculum & Golden-Set Authoring (Layer 4)

**Purpose**: The hand-authored, human-verified content that gates v1 (clarify decision). Extends the
T010 key skeleton; depends on the eval scorer (T019).

- [ ] T045 [US2] Author the **full A1→A2 curriculum tree** in `data/curriculum/` — expand the T010 A1 key skeleton with `canDo` competencies + `targetVocab`, and add the A2 nodes (grounded in docs/10 sources, rephrased not copied, prerequisites + borderline marks + required flags) per `CurriculumNode`
- [ ] T046 Validate the curriculum tree in `tests/curriculum/tree.test.ts`: unique keys, all prerequisites resolve, levels/required flags valid, A1 keys consistent with T010
- [ ] T047 [US1] Author the golden set in `data/golden/` — ≥150 hand-written A1–A2 cases (case suffixes, possessive agreement, postpositions, vowel harmony, core tenses) including 25–30% correct sentences; leakage-safe (not seeded from public GECTurk)
- [ ] T048 [P] Add a supplementary GECTurk `movie_reviews` diversity sample (apache-2.0) to `data/golden/` as a non-core supplement (clearly separated)
- [ ] T049 [US1] Implement the golden-set runner + `npm run eval` in `lib/eval/run.ts`; record the baseline F0.5 + overcorrection rate per CEFR level
- [ ] T050 Add a GitHub Actions workflow (`.github/workflows/eval.yml`) running Vitest + the eval gate on changes to teacher/analyzer prompts or model config; block on F0.5 regression or raised overcorrection (FR-030)

**Checkpoint**: Curriculum drives selection; eval baseline recorded; CI gate active (SC-001).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Reliability, deployment, and final validation.

- [ ] T051 Implement self-alert to the authorized learner on errors/outages and confirm structured logging wraps every AI call (FR-027, docs/09 Q12)
- [ ] T052 [P] Token-spend logging per turn in `lib/ai/` (docs/09 Q7/Q12)
- [ ] T053 [P] Add `Dockerfile` (Next.js standalone) ensuring morphology data files are copied into the image; add `compose.yaml`
- [ ] T054 Add a webhook-registration script (`setWebhook` with secret token, `APP_URL`) in `scripts/`
- [ ] T055 [P] Optional: periodic JSON export of learning data (docs/09 Q11) in `lib/scheduler/`
- [ ] T056 Run `quickstart.md` end-to-end validation scenarios 1–6 and confirm the v1 Definition of Done

---

## Dependencies & Execution Order

### Layer (phase) dependencies
- **Phase 1 Setup** → no deps.
- **Phase 2 Foundational** → after Setup. Blocks everything below. Now includes the A1 taxonomy keys (T010) and default-settings seed (T011).
- **Phase 3 Pure Core** → after Foundational. The deterministic backbone; mostly parallel.
- **Phase 4 AI/Zod** → after Phase 3 (needs morphology gate T023, mastery T013, srs T015, curriculum keys/selection T017).
- **Phase 5 Telegram** → after Phase 4 (needs orchestrator T033, analyzer, schemas).
- **Phase 6 Content** → full authoring T045 extends T010 and needs T017; golden set + eval need T019/T049.
- **Phase 7 Polish** → after the feature paths exist.

### Key task dependencies
- T010 (A1 key skeleton) blocks T017 (real-key selection), T027 (grammarPoint validation), and T045 (full authoring extends it).
- T011 (default settings seed) is consumed by T031 (context builder) and applies after T041 (onboarding creates the profile).
- T023 (morphology) blocks T027/T029 (AI must gate Turkish forms).
- T017 (curriculum type/selection) blocks T045.
- T033 (handleTurn) blocks T036 (webhook drives it) and depends on T031/T032.
- T030 (summary) is used by T044 (idle-session sweep).
- T049 (eval runner) depends on T019 (scorer) + T047 (golden set); T050 (CI gate) depends on T049.

### Parallel opportunities
- All `[P]` Setup tasks (T002–T005) together.
- Phase 3 is highly parallel: T012/T014/T016/T018/T020/T022 (tests) and their implementations run as independent module pairs.
- T026 (schemas) parallel with T025 (provider).
- T048, T052, T053, T055 are independent `[P]` polish tasks.

---

## Parallel Example: Phase 3 (pure core)

```bash
# Independent test→impl module pairs can be built in parallel (different files):
Pair A: T012 + T013  (lib/mastery)
Pair B: T014 + T015  (lib/srs)
Pair C: T016 + T017  (lib/curriculum)
Pair D: T018 + T019  (lib/eval)
Pair E: T020 + T021  (lib/telegram/split)
Pair F: T022 + T023  (lib/morphology)
Pair G: T024        (lib/progress)
```

---

## Implementation Strategy

### MVP first (US1 — intelligent conversation with deep correction)
The thinnest valuable slice: Setup + Foundational (incl. T010 A1 keys) → the pure core it needs
(T022/T023 morphology, plus message-split T020/T021) → AI layer for US1 (T025, T026, T027, T028,
T032, T033, T035) → Telegram for US1 (T036, T037, T038, T040) → a minimal golden set + eval (subset
of T047/T049) to prove correction quality. **Stop and validate** scenario 1–2 from quickstart.md
before widening.

### Incremental delivery
1. Setup + Foundational + Pure Core (Phase 1–3) → deterministic backbone tested green.
2. + US1 AI & Telegram → talk + deep correction working (MVP).
3. + US2 (mastery wiring T034, context T031, goals T043, summary T030, curriculum authoring T045) → adaptation across sessions.
4. + US3 (cards T029, review T039) → SRS.
5. + US4 (onboarding T041, progress T042, scheduler T044) → engagement.
6. + Phase 6 content/eval gate + Phase 7 polish → v1 Definition of Done.

### Notes
- `[P]` = different files, no incomplete dependency.
- Pure modules: test before implementation (red → green); commit after each task or logical pair.
- Never let a client/transport task introduce pedagogical logic (Principle VII).
- Every Turkish form emitted must pass `morphology.isValid` before persistence/display (FR-008).
