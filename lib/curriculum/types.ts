import type { CefrLevel } from "../config/constants";

/**
 * A curriculum skill-tree node. Reference data (docs/02 decision), grounded in approved sources
 * (docs/10). In the T010 A1 *skeleton*, `canDo` is empty and `targetVocab` is `[]`; these are
 * filled when the full A1→A2 tree is authored (T045).
 */
export interface CurriculumNode {
  /** Stable id; also the key used by grammar_mastery.grammar_point and analyzer grammarPoint. */
  key: string;
  level: CefrLevel;
  /** Human-readable grammar label. */
  grammarPoint: string;
  /** Functional "can-do" competency (filled in T045). */
  canDo: string;
  /** Target vocabulary for this node (filled in T045). */
  targetVocab: string[];
  /** Keys of nodes that must be mastered first. */
  prerequisites: string[];
  /** Counts toward CEFR derivation (vs. optional/borderline). */
  required: boolean;
  /** Contested CEFR placement (docs/10) — placed flexibly by the learner model. */
  borderline: boolean;
}
