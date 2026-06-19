# Feature Specification: Proactive Teacher

**Feature Branch**: `002-proactive-teacher`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Proactive teacher in two parts: (1) the tutor continues the conversation after the learner acts — especially after answering a quiz card — leading to the next step instead of going silent; (2) the tutor initiates messages without an inbound learner message via the internal scheduler — a daily reminder and an inactivity nudge. Tied to the planned internal scheduler (session-idle sweep + SRS due + daily reminder, US4/T044) and the learner model. Single-user, Telegram. Also fix quiz-state recovery across restarts. Avoid nagging: frequency caps and respect for the learner's quiet."

## Overview

Today the tutor only responds to a fresh text message. After the learner answers a quiz card (a
button press), the tutor reveals the answer and **goes silent** — there is no path that continues
the conversation. And the tutor never reaches out on its own. This feature makes the tutor
**proactive** in two ways: it leads the conversation forward after the learner acts, and it
initiates contact (reminders / inactivity nudges) when appropriate — all grounded in the learner
model and bounded so it never nags. It unifies and extends the previously-specified daily reminder
(001 FR-024) and scheduler (001 US4) and adds post-action continuation.

## Clarifications

### Session 2026-06-19

- Q: After a quiz answer, how does the tutor continue? → A: Always exactly one continuation — deterministically reveal the result + send one next-step message (content by teacher judgment), then wait. The *decision* to continue is deterministic (never silent); the *content* is intelligent.
- Q: Max proactive (bot-initiated) messages per day? → A: 2 per day (e.g. one daily reminder + at most one inactivity nudge).
- Q: Inactivity threshold before a re-engagement nudge? → A: 2 days of no activity.
- Q: Quiet hours? → A: Yes — no outreach during a configurable quiet window (default e.g. 09:00–21:00) using a configured timezone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversation continues after the learner acts (Priority: P1)

After the learner answers a quiz card (button press) or sends a reply, the tutor — by its own
pedagogical judgment — leads to the next step: a brief reaction to what just happened, then a
follow-up (continue the topic, ask a question, offer the next small exercise, or move to the next
focus). It no longer falls silent after revealing a quiz result.

**Why this priority**: This is the felt fix for the reported problem ("the tutor went silent after
my answer, especially after the quiz card"). It directly restores the sense of a teacher who keeps
teaching.

**Independent Test**: Answer a quiz card and verify the tutor sends a coherent next-step message
(reaction + lead-forward) grounded in whether the answer was right/wrong and the learner's level;
verify it does not produce an endless self-chain (it leads, then waits for the learner).

**Acceptance Scenarios**:

1. **Given** the tutor has sent a quiz card, **When** the learner taps an answer, **Then** the tutor
   reveals correct/incorrect with the explanation AND follows with a next-step message (e.g. a brief
   reaction plus a follow-up question or the next item).
2. **Given** the learner answered correctly, **When** the tutor continues, **Then** it acknowledges
   success and advances (harder item / next focus).
3. **Given** the learner answered incorrectly, **When** the tutor continues, **Then** it reinforces
   the point (brief re-teach or an easier follow-up) rather than just moving on.
4. **Given** the tutor continues after an action, **When** it has led to the next step, **Then** it
   stops and waits for the learner (exactly one proactive follow-up per learner action — no
   self-talk loop).
5. **Given** a quiz card was sent before a service restart, **When** the learner taps an answer
   afterward, **Then** the answer is still graded correctly (quiz state survives restarts) rather
   than the button silently doing nothing.

---

### User Story 2 - Tutor initiates contact when the learner is away (Priority: P2)

Without any inbound message, the tutor reaches out: a daily reminder (review due cards or hold a
session) and an inactivity nudge if the learner has been away for a while. Outreach is grounded in
the learner model (due reviews, current focus, weaknesses, last-active) and is bounded so it never
nags.

**Why this priority**: Sustains long-term engagement and makes the tutor feel present. It depends on
the scheduler and learner model already being in place; the continuation (US1) is the more acute
fix.

**Independent Test**: Simulate the scheduler tick with due reviews / a past-due day / a long absence
and verify the appropriate single message is sent, that it reflects the learner's state, and that
frequency caps prevent more than the allowed number of proactive messages per day.

**Acceptance Scenarios**:

1. **Given** the daily schedule runs and there are due reviews or no session today, **When** the
   tick fires, **Then** the learner receives one reminder reflecting their due items / current focus.
2. **Given** the learner has been inactive beyond the inactivity threshold, **When** the scheduler
   evaluates outreach, **Then** the learner receives one gentle re-engagement nudge.
3. **Given** a proactive message was already sent today, **When** another outreach would trigger,
   **Then** it is suppressed to respect the daily frequency cap.
4. **Given** the learner is currently active (recent message), **When** outreach is evaluated,
   **Then** no reminder/nudge is sent (respect the learner's quiet / active session).
5. **Given** a proactive message is generated, **When** it is composed, **Then** it follows the same
   language rules as the tutor (Arabic-dominant, level-appropriate).

---

### Edge Cases

- **No self-talk loop**: a learner action triggers at most one proactive continuation; the tutor
  then waits. The continuation never triggers another continuation.
- **Quiz state across restart**: quiz grading must not depend on volatile in-memory state; a button
  tapped after a restart still grades correctly, or fails gracefully with a friendly message (never
  a dead silent button).
- **Frequency caps**: at most a bounded number of proactive (scheduler-initiated) messages per day;
  reminders and nudges do not stack.
- **Respect activity**: no proactive outreach while the learner is mid-session or has just messaged.
- **Outreach failure**: a failed proactive send is logged and retried per policy; it never crashes
  the scheduler or affects other learner state.
- **Quiet hours**: outreach is suppressed during the configured quiet window (timezone-aware);
  due outreach is deferred to the next allowed time or skipped — never sent during quiet hours.

## Requirements *(mandatory)*

### Functional Requirements

**Post-action continuation (US1)**

- **FR-001**: After the learner answers a quiz card, the system MUST — deterministically, every time
  — in addition to revealing the result + explanation, deliver exactly one tutor-judged next-step
  message (reaction + lead-forward). The decision to continue is deterministic (never silent); the
  content is by the teacher's judgment.
- **FR-002**: The continuation MUST be grounded in the outcome (correct vs. incorrect) and the
  learner's level — reinforcing on a wrong answer, advancing on a correct one.
- **FR-003**: Exactly one proactive continuation MUST follow a single learner action; the
  continuation MUST NOT itself trigger further proactive messages (no self-talk loop).
- **FR-004**: Quiz answers MUST be graded reliably regardless of service restarts — quiz state MUST
  be recoverable (not solely held in volatile memory); a stale/unrecoverable quiz button MUST fail
  gracefully with a friendly message, never a silent no-op.
- **FR-005**: Continuation messages MUST follow the tutor's language rules (Arabic-dominant,
  level-appropriate) and pass the same correctness gates as any tutor output.

**Scheduler-initiated outreach (US2)**

- **FR-006**: The system MUST send a daily reminder (review due cards / hold a session) grounded in
  the learner model (due reviews, current focus), via the internal scheduler.
- **FR-007**: The system MUST send a gentle re-engagement nudge when the learner has been inactive
  beyond a configurable inactivity threshold (default: 2 days of no activity).
- **FR-008**: Proactive outreach MUST be bounded by a configurable daily frequency cap (default: 2
  per day); reminders and nudges MUST NOT stack beyond it.
- **FR-009**: The system MUST NOT send proactive outreach while the learner is active (recent
  activity / mid-session).
- **FR-010**: Proactive messages MUST follow the tutor's language rules (Arabic-dominant,
  level-appropriate) and be grounded in the learner model.
- **FR-011**: The system MUST record when proactive messages are sent (to enforce caps and avoid
  duplicates) and MUST recover correctly across restarts.

**Cross-cutting**

- **FR-012**: All proactive sends MUST be wrapped with logging and friendly fallback; a failure MUST
  NOT crash the scheduler or corrupt learner state (consistent with 001 reliability principles).
- **FR-013**: Proactive behavior MUST be driven by the single internal scheduler (unifying the
  session-idle sweep, SRS-due check, and daily reminder from 001 US4/T044) — no separate
  infrastructure.
- **FR-014**: The system MUST NOT send proactive outreach during a configurable quiet window
  (default e.g. 09:00–21:00 active) evaluated in a configured timezone; outreach due during quiet
  hours is deferred to the next allowed time or skipped, never sent late at night.

### Key Entities *(include if feature involves data)*

- **Outreach log / state**: a record of proactive messages sent (type: reminder | nudge | …, time),
  used to enforce the daily cap (2/day), avoid duplicates, and recover across restarts. (Extends the
  learner model; `last_active` already exists on the learner profile.)
- **Outreach config**: timezone + quiet-window + daily cap + inactivity threshold (config-provided
  defaults; quiet window evaluated in the configured timezone).
- **Quiz card state**: the quiz payload tied to a sent message, recoverable across restarts so an
  answer can be graded later (today's data model already stores the quiz in the message; what is
  missing is the link from the delivered card back to that stored payload).
- **Learner model (existing)**: level, weaknesses, due reviews, current focus, last-active — the
  grounding for both continuation and outreach.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After answering a quiz, the learner receives a coherent next-step message in 100% of
  quiz answers (no silent stop).
- **SC-002**: A single learner action yields exactly one proactive continuation — never a chain of
  unsolicited messages.
- **SC-003**: Quiz answers grade correctly after a restart in 100% of cases (no dead buttons).
- **SC-004**: Proactive (scheduler-initiated) messages never exceed the configured daily cap.
- **SC-005**: No proactive message is sent while the learner is active (recent activity / session).
- **SC-006**: 100% of proactive and continuation messages follow the Arabic-dominant, level-scaled
  language rules.
- **SC-007**: A failed proactive send never crashes the scheduler and is visible in logs (zero
  silent scheduler failures).
- **SC-008**: No proactive message is sent during the configured quiet window (timezone-aware) —
  0 late-night sends.

## Assumptions

- **Single user** over Telegram (consistent with 001).
- **The internal scheduler from 001 (US4/T044) is the delivery mechanism**; this feature unifies the
  daily reminder + session-idle sweep + SRS-due check there and adds outreach policy on top.
- **The teacher's structured judgment (001) is reused** to generate continuation/outreach content;
  no new model is introduced.
- **Frequency cap and inactivity threshold are configurable** — defaults set in clarify: max 2
  proactive messages/day; inactivity nudge after 2 days of no activity.
- **Quiet hours are in scope**: a configurable timezone-aware quiet window (default e.g. 09:00–21:00
  active); the learner's timezone is config-provided.
- **"Continuation" is exactly one follow-up turn** after a learner action, then the tutor waits —
  the decision to continue is deterministic (no silence), the content is the teacher's judgment.
