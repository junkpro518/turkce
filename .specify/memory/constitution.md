<!--
SYNC IMPACT REPORT
==================
Version change: (template, unratified) → 1.0.0
Rationale: Initial ratification. Replaces the unfilled Spec Kit template with the
project's governing principles distilled from docs/00–10 (all 14 open questions decided).

Principles defined (7):
  I.   Intelligence in Conversation, Determinism in Support Systems
  II.  Depth Before Breadth
  III. Spec Kit Is the Only Path to Code
  IV.  Reliability — No Lost State, No Silent Failure
  V.   Teacher Correctness (Defense in Depth)
  VI.  Curriculum Grounded in Authoritative Sources
  VII. Single TypeScript Codebase, Engine/Client Separation

Added sections: Technology Constraints; Development Workflow & Quality Gates; Governance.
Removed sections: none (template placeholders replaced).

Templates / artifacts reviewed:
  ✅ .specify/templates/plan-template.md — Constitution Check is generic
     ("[Gates determined based on constitution file]"); resolves against this file at plan time. No edit needed.
  ✅ .specify/templates/spec-template.md — no hardcoded principles; no edit needed.
  ✅ .specify/templates/tasks-template.md — task categories are principle-agnostic; no edit needed.
  ✅ AGENTS.md / CLAUDE.md — generic process guidelines; consistent, no contradiction.
  ✅ docs/ — source of truth for what/why; this constitution governs how.

Deferred TODOs: none.
-->

# turkce Constitution

Personal AI Turkish tutor. Primary interface: Telegram. Companion interface (later): a light
web dashboard. The product is built around a **living learner model**; every practice mode
branches from it. This constitution encodes the non-negotiable engineering and product gates
distilled from `docs/00–10`. `docs/` remains the source of truth for *what* and *why*; this
document governs *how* work is allowed to proceed.

## Core Principles

### I. Intelligence in Conversation, Determinism in Support Systems

The single governing principle. Intelligence lives in the live conversation; everything that
supports it is deterministic and tested.

- Any logic expressible as a deterministic pure function MUST be implemented as one and MUST
  have Vitest coverage — including FSRS scheduling, mastery math (EWMA), per-skill CEFR
  derivation, next-focus selection, message splitting, and F0.5 scoring.
- All LLM output consumed by the system MUST sit behind a Zod schema with validation and a
  fallback path. Raw, unvalidated LLM text MUST NOT drive any state transition.
- The teacher LLM governs the **conversation and pedagogical mode only**. It MUST NOT control
  curriculum sequencing, SRS scheduling, or mastery updates — those are deterministic modules.

**Rationale:** The previous two versions failed by either over-delegating to an agent
framework or burying logic in a thin bridge. Determinism where determinism belongs makes the
core testable and stable; intelligence stays where it adds value.

### II. Depth Before Breadth

- No new feature, pattern, or interface ships until the prior one meets its measurable
  definition of "excellent."
- v1 scope is fixed: the full engine + intelligent text conversation with deep correction over
  Telegram + SRS + adaptive curriculum (A1→A2 first) + progress. Deferred items — web, voice,
  immersion, multi-user — MUST NOT leak into v1 specs, plans, or code.
- No speculative abstraction or configurability beyond current need.

**Rationale:** "Breadth without depth" (12 shallow pages, 28 API routes) sank the prior web
version. A small, excellent core earns the right to expand.

### III. Spec Kit Is the Only Path to Code

- Every feature or meaningful change passes the full flow: specify → clarify → plan → tasks →
  implement (plus analyze / checklist when warranted), grounded in the relevant `docs/`.
- No implementation code is written before the tasks are approved. Each artifact is presented
  for review before moving to the next phase.
- Spec artifacts are the single source of truth for *how*; `docs/` for *what* and *why*.
- Exempt (no full spec): typos, formatting, comment/doc wording, running tests, fixing imports
  broken by a recent change — provided they change no behavior, schema, API contract, security
  rule, or architecture.

**Rationale:** Mandated for all phases (Q13). Discipline here prevents the ad-hoc complexity
that killed prior versions.

### IV. Reliability — No Lost State, No Silent Failure

- All learner state MUST persist in Supabase. No in-memory state that is lost on restart.
- Every AI call MUST be wrapped with try/catch, structured logging, and a friendly user-facing
  fallback. Technical errors MUST NOT reach the user; errors MUST NOT be silently swallowed.
- Analyzer failure MUST degrade gracefully and MUST NEVER block the reply. Teacher failure MUST
  retry and/or fall back to the backup model.
- Responses exceeding Telegram limits MUST be split rather than dropped.

**Rationale:** Direct fixes for documented prior failures — in-memory sessions lost on restart,
no streaming, >4096-char drops, missing logging, raw error leaks, 502 fragility.

### V. Teacher Correctness (Defense in Depth)

Turkish morphology is where LLMs fail most; correctness is defended in layers.

- Every Turkish word/form/SRS-card the teacher produces MUST pass deterministic morphological
  grounding (`nlptoolkit-morphologicalanalysis`, in-Node). Zero analyses ⇒ reject and regenerate.
- The correction and SRS-card-building critical path MUST use the strong analyzer model (not the
  cheap teacher model), at low temperature, behind Zod.
- Corrections MUST run an anti-overcorrection pass (overcorrection is worse than a miss).
- Teacher correctness MUST be measured by the eval harness — F0.5 over edit spans plus
  overcorrection rate, per CEFR level — and a CI gate MUST block any teacher/analyzer prompt or
  model change that drops F0.5 below threshold or raises overcorrection.

**Rationale:** The risk is documented and severe (Q2). Layered, measured defense prevents the
tutor from teaching wrong Turkish or "correcting" correct sentences.

### VI. Curriculum Grounded in Authoritative Sources

- The CEFR skill tree MUST be grounded in approved sources — Türkiye Maarif Vakfı (MEB),
  Khozrevanidze & Arslan (2024), verified against Yedi İklim — not LLM improvisation.
- AI MAY rephrase and structure; a human MUST verify; curricular facts are reused but verbatim
  text MUST NOT be copied (rephrase in Arabic/Turkish).

**Rationale:** If the LLM invents the curriculum, shallowness returns (Q1). Grounding keeps
content authoritative and legally safe.

### VII. Single TypeScript Codebase, Engine/Client Separation

- One TypeScript codebase (no Python/TS split).
- The pedagogical engine (`lib/`) MUST be interface-agnostic. Clients (Telegram first, web
  later) MUST be thin and MUST contain no pedagogical logic.

**Rationale:** Putting logic in a thin client and then deleting it for an external agent is
exactly what killed `TR_AR_AI`. The engine owns the logic; clients only talk to it.

## Technology Constraints

- **Hard rejections (non-negotiable):** NO LangGraph, LangChain, Hermes, or any agentic
  framework that controls the whole system. AI provider calls go **directly** via OpenRouter
  (through the Vercel AI SDK) — no fragile HTTP bridge or subprocess.
- **Approved stack:** Next.js 15 (App Router), TypeScript, Supabase (PostgreSQL) + Drizzle ORM,
  Vercel AI SDK, Zod, grammY, Vitest, OpenRouter. Models are swappable via env and the final
  choice is validated by eval numbers — "newest" is not assumed best for Turkish.
- **Security:** access restricted to the authorized `telegram_user_id`; webhook signature
  verified via secret token; secrets live only in environment variables, never in the repo.

## Development Workflow & Quality Gates

- Spec Kit MUST be installed and on the latest update before Spec-Kit-dependent work begins; if
  the upgrade cannot be completed, stop and notify the user.
- Deterministic logic MUST have passing Vitest coverage before its feature is considered done.
- The eval-harness CI gate MUST pass before shipping any teacher/analyzer prompt or model change.
- Each Spec Kit artifact (spec, clarify, plan, tasks) is committed and pushed, then reviewed,
  before the next phase begins.
- `CLAUDE.md` and `AGENTS.md` MUST stay aligned on shared core rules.

## Governance

This constitution supersedes other practices where they conflict. Amendments require a written
change, a semantic version bump, and propagation to dependent templates and guidance files.
Any deviation from a principle MUST be justified in the plan's Complexity Tracking section with
the simpler alternative explicitly considered and rejected. All plans and reviews verify
compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-06-17 | **Last Amended**: 2026-06-17
