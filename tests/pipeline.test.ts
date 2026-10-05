import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/ai/groq", () => ({
  callJSON: vi.fn(),
}));

import { callJSON } from "../src/lib/ai/groq";
import {
  PipelineInputError,
  runPipeline,
} from "../src/lib/ai/pipeline";

const mockedCallJSON = vi.mocked(callJSON);
const guideline = "The applicant must submit a signed authorization letter. ".repeat(5);
const application = "The applicant will deliver monthly workshops and record attendance. ".repeat(5);

beforeEach(() => {
  mockedCallJSON.mockReset();
});

describe("AI pipeline post-processing", () => {
  it("verifies fabricated guideline and application quotes", async () => {
    mockedCallJSON
      .mockResolvedValueOnce({
        requirements: [
          {
            id: "R1",
            text: "Submit an authorization letter",
            type: "mandatory",
            category: "attachment",
            sourceQuote: "The applicant must submit a signed authorization letter.",
          },
          {
            id: "R2",
            text: "Use the grant for any purpose",
            type: "recommended",
            category: "fabricated",
            sourceQuote: "The grant guarantees funding for every applicant.",
          },
        ],
      })
      .mockResolvedValueOnce({
        mappings: [
          {
            requirementId: "R1",
            applicationQuote: "The application includes a signed authorization letter.",
            evidenceStrength: "strong",
            reasoning: "The draft appears to include the attachment.",
            neededDocuments: [],
            clarificationQuestions: [],
          },
          {
            requirementId: "R2",
            applicationQuote: null,
            evidenceStrength: "missing",
            reasoning: "No evidence was found.",
            neededDocuments: [],
            clarificationQuestions: ["What evidence supports this requirement?"],
          },
        ],
      })
      .mockResolvedValueOnce({
        claims: [
          {
            claim: "The applicant will deliver monthly workshops.",
            quote: "The applicant will deliver monthly workshops and record attendance.",
            reason: "No supplied document supports the delivery claim.",
          },
        ],
      });

    const result = await runPipeline({
      guideline,
      application,
      supportingDocs: [],
    });

    expect(result.requirements[0]?.sourceQuoteValid).toBe(true);
    expect(result.requirements[1]?.sourceQuoteValid).toBe(false);
    expect(result.mappings[0]).toMatchObject({
      citationValid: false,
      evidenceStrength: "missing",
    });
    expect(result.mappings[0]?.reasoning).toContain(
      "could not be verified",
    );
    expect(result.mappings[1]?.citationValid).toBe(false);
    expect(result.unsupportedClaims[0]?.quoteValid).toBe(true);
    expect(mockedCallJSON).toHaveBeenCalledTimes(3);
  });

  it("rejects documents below the minimum length before calling AI", async () => {
    await expect(
      runPipeline({
        guideline: "Too short",
        application,
        supportingDocs: [],
      }),
    ).rejects.toBeInstanceOf(PipelineInputError);
    expect(mockedCallJSON).not.toHaveBeenCalled();
  });

  it("rejects documents above the maximum length before calling AI", async () => {
    await expect(
      runPipeline({
        guideline: `${"x".repeat(24_001)}`,
        application,
        supportingDocs: [],
      }),
    ).rejects.toBeInstanceOf(PipelineInputError);
    expect(mockedCallJSON).not.toHaveBeenCalled();
  });
});
