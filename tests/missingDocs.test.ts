import { describe, expect, it } from "vitest";

import {
  missingDocs,
  type SupportingDocument,
} from "../src/lib/logic/missingDocs";

const document = (
  overrides: Partial<SupportingDocument> = {},
): SupportingDocument => ({
  id: "doc-1",
  name: "Budget.pdf",
  type: "budget",
  status: "missing",
  linkedRequirementId: "requirement-1",
  ...overrides,
});

describe("missing document logic", () => {
  it("returns supporting documents marked missing", () => {
    expect(missingDocs([document()], [])).toEqual({
      missing: [document()],
      missingMandatoryRequirementCount: 0,
    });
  });

  it("ignores provided documents in the missing list", () => {
    expect(
      missingDocs([document({ status: "provided" })], []),
    ).toEqual({ missing: [], missingMandatoryRequirementCount: 0 });
  });

  it("counts a mandatory requirement needing an unprovided document", () => {
    expect(
      missingDocs([], [
        {
          id: "requirement-1",
          type: "mandatory",
          needsSupportingDocument: true,
        },
      ]),
    ).toEqual({ missing: [], missingMandatoryRequirementCount: 1 });
  });

  it("does not count a mandatory requirement linked to a provided document", () => {
    expect(
      missingDocs([document({ status: "provided" })], [
        {
          id: "requirement-1",
          type: "mandatory",
          needsSupportingDocument: true,
        },
      ]),
    ).toEqual({ missing: [], missingMandatoryRequirementCount: 0 });
  });

  it("does not count recommended document needs in the mandatory count", () => {
    expect(
      missingDocs([], [
        {
          id: "requirement-1",
          type: "recommended",
          needsSupportingDocument: true,
        },
      ]),
    ).toEqual({ missing: [], missingMandatoryRequirementCount: 0 });
  });
});
