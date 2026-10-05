import { describe, expect, it } from "vitest";

import { hashText, isStale } from "../src/lib/logic/stale";

describe("stale logic", () => {
  it("normalizes whitespace before hashing", () => {
    expect(hashText("A  grant\n guideline")).toBe(hashText(" A grant guideline "));
  });

  it("does not mark whitespace-only changes as stale", () => {
    const run = {
      guidelineHash: hashText("Guideline text"),
      applicationHash: hashText("Application text"),
    };
    const latest = {
      guidelineHash: hashText("  Guideline   text\n"),
      applicationHash: hashText("Application text"),
    };

    expect(isStale(run, latest)).toBe(false);
  });

  it("marks a guideline edit as stale", () => {
    expect(
      isStale(
        { guidelineHash: "guideline-v1", applicationHash: "application-v1" },
        { guidelineHash: "guideline-v2", applicationHash: "application-v1" },
      ),
    ).toBe(true);
  });

  it("marks an application edit as stale", () => {
    expect(
      isStale(
        { guidelineHash: "guideline-v1", applicationHash: "application-v1" },
        { guidelineHash: "guideline-v1", applicationHash: "application-v2" },
      ),
    ).toBe(true);
  });
});
