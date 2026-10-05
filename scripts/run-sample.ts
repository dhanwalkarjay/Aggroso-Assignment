import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { logger } from "../src/lib/logger";
import { runPipeline } from "../src/lib/ai/pipeline";

const samplePath = (name: string) =>
  resolve(process.cwd(), "samples", name);

async function main() {
  const [guideline, application] = await Promise.all([
    readFile(samplePath("guideline.txt"), "utf8"),
    readFile(samplePath("application.txt"), "utf8"),
  ]);
  const result = await runPipeline({
    guideline,
    application,
    supportingDocs: [
      {
        name: "Signed organizational authorization letter",
        type: "authorization",
        status: "missing",
      },
      {
        name: "Detailed project schedule",
        type: "schedule",
        status: "missing",
      },
    ],
  });

  logger.info(
    {
      requirements: result.requirements.length,
      mandatoryRequirements: result.requirements.filter(
        (requirement) => requirement.type === "mandatory",
      ).length,
      mappings: result.mappings.map((mapping) => ({
        requirementId: mapping.requirementId,
        evidenceStrength: mapping.evidenceStrength,
        citationValid: mapping.citationValid,
      })),
      clarificationQuestionCount: result.mappings.reduce(
        (count, mapping) => count + mapping.clarificationQuestions.length,
        0,
      ),
      unsupportedClaims: result.unsupportedClaims.map((claim) => ({
        claim: claim.claim,
        quoteValid: claim.quoteValid,
      })),
    },
    "Sample completeness analysis",
  );
}

void main();
