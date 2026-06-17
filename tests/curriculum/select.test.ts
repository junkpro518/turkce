import { describe, expect, it } from "vitest";
import { A1_KEYS } from "../../data/curriculum/keys";
import { selectNextFocus } from "../../lib/curriculum";
import type { MasteryStatus } from "../../lib/mastery";

const NO_PREREQ = A1_KEYS.filter((n) => n.prerequisites.length === 0).map((n) => n.key);

describe("selectNextFocus", () => {
  it("initially picks a node with no prerequisites", () => {
    const pick = selectNextFocus(A1_KEYS, new Map());
    expect(pick).not.toBeNull();
    expect(pick!.prerequisites.length).toBe(0);
  });

  it("does not offer a node whose prerequisites are unmet", () => {
    const pick = selectNextFocus(A1_KEYS, new Map());
    // vowel-harmony requires alphabet-sounds (not yet mastered) → never first
    expect(pick!.key).not.toBe("vowel-harmony");
  });

  it("unlocks dependents once prerequisites are mastered", () => {
    const mastery = new Map<string, MasteryStatus>(
      NO_PREREQ.map((k) => [k, "mastered"]),
    );
    const pick = selectNextFocus(A1_KEYS, mastery);
    // alphabet-sounds is mastered → vowel-harmony / consonant-changes become selectable
    expect(["vowel-harmony", "consonant-changes"]).toContain(pick!.key);
  });

  it("favors a node serving the highest-priority active goal", () => {
    const mastery = new Map<string, MasteryStatus>(
      NO_PREREQ.map((k) => [k, "mastered"]),
    );
    const pick = selectNextFocus(A1_KEYS, mastery, [
      { id: "g1", priority: 1, status: "active", relatedKeys: ["consonant-changes"] },
    ]);
    expect(pick!.key).toBe("consonant-changes");
  });

  it("returns null when everything is mastered", () => {
    const all = new Map<string, MasteryStatus>(A1_KEYS.map((n) => [n.key, "mastered"]));
    expect(selectNextFocus(A1_KEYS, all)).toBeNull();
  });
});
