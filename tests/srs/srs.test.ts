import { describe, expect, it } from "vitest";
import { newCard, review } from "../../lib/srs";

const NOW = new Date("2026-01-01T12:00:00.000Z");

describe("srs", () => {
  it("is deterministic: same card + rating + time → identical due (SC-007)", () => {
    const card = newCard(NOW);
    const a = review(card, "good", NOW);
    const b = review(card, "good", NOW);
    expect(a.due.getTime()).toBe(b.due.getTime());
    expect(a.stability).toBe(b.stability);
    expect(a.difficulty).toBe(b.difficulty);
  });

  it("schedules a 'good' review into the future", () => {
    const card = newCard(NOW);
    const next = review(card, "good", NOW);
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.reps).toBeGreaterThan(0);
  });

  it("'easy' is scheduled no sooner than 'good'", () => {
    const card = newCard(NOW);
    const good = review(card, "good", NOW);
    const easy = review(card, "easy", NOW);
    expect(easy.due.getTime()).toBeGreaterThanOrEqual(good.due.getTime());
  });

  it("'forgot' reschedules a learned card sooner than 'good'", () => {
    const learned = review(newCard(NOW), "good", NOW);
    const at = new Date(learned.due.getTime());
    const forgot = review(learned, "forgot", at);
    const good = review(learned, "good", at);
    expect(forgot.due.getTime()).toBeLessThan(good.due.getTime());
  });
});
