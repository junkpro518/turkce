import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";
import type { Card, Grade } from "ts-fsrs";

// Deterministic spaced repetition over ts-fsrs (FR-019, SC-007). enable_fuzz MUST be false so the
// same card + rating + time always yields the same schedule.
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export type SrsRating = "forgot" | "hard" | "good" | "easy";

const RATING: Record<SrsRating, Grade> = {
  forgot: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export type { Card };

/** A fresh card due immediately. */
export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

/** Apply a review rating at `now`; returns the rescheduled card (pure, deterministic). */
export function review(card: Card, rating: SrsRating, now: Date): Card {
  return scheduler.next(card, now, RATING[rating]).card;
}
