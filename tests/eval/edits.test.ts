import { describe, expect, it } from "vitest";
import { extractEdits, toScoreEdit } from "../../lib/eval/edits";

describe("extractEdits", () => {
  it("returns no edits for identical sentences", () => {
    expect(extractEdits("Ben su içiyorum.", "Ben su içiyorum.")).toEqual([]);
  });

  it("extracts a single-token suffix change", () => {
    expect(extractEdits("Kitap masa.", "Kitap masada.")).toEqual([
      { source: "masa", target: "masada" },
    ]);
  });

  it("extracts a change at the end of the sentence", () => {
    expect(extractEdits("Ben su içiyor.", "Ben su içiyorum.")).toEqual([
      { source: "içiyor", target: "içiyorum" },
    ]);
  });

  it("handles a numeral+plural removal (token becomes another token)", () => {
    expect(extractEdits("Üç kitaplar var.", "Üç kitap var.")).toEqual([
      { source: "kitaplar", target: "kitap" },
    ]);
  });

  it("ignores punctuation differences only", () => {
    expect(extractEdits("Merhaba", "Merhaba!")).toEqual([]);
  });

  it("encodes a token edit as a position-independent score edit", () => {
    expect(toScoreEdit({ source: "masa", target: "masada" })).toEqual({
      start: 0,
      end: 0,
      replacement: "masa=>masada",
    });
  });
});
