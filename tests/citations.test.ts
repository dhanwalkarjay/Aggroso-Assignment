import { describe, expect, it } from "vitest";

import { quoteExists } from "../src/lib/logic/citations";

describe("citation logic", () => {
  it("accepts an exact quote", () => {
    expect(quoteExists("The project starts in June 2026.", "The project starts in June 2026.")).toBe(true);
  });

  it("ignores case and normalizes smart quotes", () => {
    expect(
      quoteExists(
        "The project uses ‘community-led’ planning.",
        "THE PROJECT USES 'community-led' PLANNING.",
      ),
    ).toBe(true);
  });

  it("rejects a fabricated quote", () => {
    expect(quoteExists("The project serves rural schools.", "The project serves urban schools.")).toBe(false);
  });

  it("rejects a null quote", () => {
    expect(quoteExists(null, "A source with enough content.")).toBe(false);
  });

  it("rejects a quote shorter than ten characters", () => {
    expect(quoteExists("the", "The project starts in June 2026.")).toBe(false);
  });
});
