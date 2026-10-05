import { describe, expect, it } from "vitest";

import {
  completion,
  isSatisfied,
  type CompletionRow,
} from "../src/lib/logic/completion";

const row = (overrides: Partial<CompletionRow> = {}): CompletionRow => ({
  type: "mandatory",
  userStatus: "confirmed",
  citationValid: true,
  ...overrides,
});

describe("completion logic", () => {
  it("counts all confirmed valid mappings as complete", () => {
    expect(completion([row(), row()])).toEqual({
      mandatory: { done: 2, total: 2, pct: 100 },
      recommended: { done: 0, total: 0, pct: 0 },
    });
  });

  it("does not count rejected mappings", () => {
    expect(isSatisfied(row({ userStatus: "rejected" }))).toBe(false);
  });

  it("does not count suggested mappings", () => {
    expect(isSatisfied(row({ userStatus: "suggested" }))).toBe(false);
  });

  it("does not count invalid confirmed citations", () => {
    expect(isSatisfied(row({ citationValid: false }))).toBe(false);
  });

  it("counts corrected mappings with valid corrected quotes", () => {
    expect(
      isSatisfied(
        row({
          userStatus: "corrected",
          citationValid: false,
          correctedQuoteValid: true,
        }),
      ),
    ).toBe(true);
  });

  it("does not count corrected mappings with invalid corrected quotes", () => {
    expect(
      isSatisfied(
        row({
          userStatus: "corrected",
          correctedQuoteValid: false,
        }),
      ),
    ).toBe(false);
  });

  it("calculates mandatory and recommended requirements separately", () => {
    expect(
      completion([
        row(),
        row({ type: "recommended", userStatus: "suggested" }),
        row({ type: "recommended", userStatus: "confirmed" }),
      ]),
    ).toEqual({
      mandatory: { done: 1, total: 1, pct: 100 },
      recommended: { done: 1, total: 2, pct: 50 },
    });
  });

  it("returns zero percentages for an empty list", () => {
    expect(completion([])).toEqual({
      mandatory: { done: 0, total: 0, pct: 0 },
      recommended: { done: 0, total: 0, pct: 0 },
    });
  });
});
