import { quoteExists } from "../logic/citations";
import {
  callJSON,
  type CallJsonOptions,
} from "./groq";
import {
  mappingsResponseSchema,
  requirementsResponseSchema,
  unsupportedClaimsResponseSchema,
  type ExtractedRequirement,
  type SuggestedMapping,
} from "./schemas";
import {
  mappingsSystemPrompt,
  mappingsUserPrompt,
  requirementsSystemPrompt,
  requirementsUserPrompt,
  unsupportedClaimsSystemPrompt,
  unsupportedClaimsUserPrompt,
} from "./prompts";

const MIN_DOCUMENT_LENGTH = 200;
const MAX_DOCUMENT_LENGTH = 24_000;

export type SupportingDocumentMetadata = {
  name: string;
  type: string;
  status: "provided" | "missing";
};

export type PipelineInput = {
  guideline: string;
  application: string;
  supportingDocs: SupportingDocumentMetadata[];
};

export type PipelineRequirement = ExtractedRequirement & {
  sourceQuoteValid: boolean;
};

export type PipelineMapping = SuggestedMapping & {
  citationValid: boolean;
};

export type PipelineUnsupportedClaim = {
  claim: string;
  quote: string;
  quoteValid: boolean;
  reason: string;
};

export type PipelineResult = {
  requirements: PipelineRequirement[];
  mappings: PipelineMapping[];
  unsupportedClaims: PipelineUnsupportedClaim[];
};

export class PipelineInputError extends Error {
  readonly code = "INVALID_DOCUMENT_LENGTH";

  constructor(documentName: string) {
    super(
      `${documentName} must be between ${MIN_DOCUMENT_LENGTH} and ${MAX_DOCUMENT_LENGTH} characters.`,
    );
    this.name = "PipelineInputError";
  }
}

const validateDocumentLength = (value: string, name: string) => {
  if (
    value.length < MIN_DOCUMENT_LENGTH ||
    value.length > MAX_DOCUMENT_LENGTH
  ) {
    throw new PipelineInputError(name);
  }
};

const missingMapping = (requirementId: string): PipelineMapping => ({
  requirementId,
  applicationQuote: null,
  evidenceStrength: "missing",
  reasoning: "No mapping was returned for this requirement.",
  neededDocuments: [],
  clarificationQuestions: [],
  citationValid: false,
});

const postProcessMapping = (
  mapping: SuggestedMapping,
  application: string,
): PipelineMapping => {
  const citationValid = quoteExists(mapping.applicationQuote, application);

  if (mapping.applicationQuote && !citationValid) {
    return {
      ...mapping,
      citationValid,
      evidenceStrength: "missing",
      reasoning: `${mapping.reasoning} The application quote could not be verified against the source text.`,
    };
  }

  return { ...mapping, citationValid };
};

export async function runPipeline(
  input: PipelineInput,
  options: CallJsonOptions = {},
): Promise<PipelineResult> {
  validateDocumentLength(input.guideline, "Guideline");
  validateDocumentLength(input.application, "Application");

  const extracted = await callJSON(
    requirementsSystemPrompt,
    requirementsUserPrompt(input.guideline),
    requirementsResponseSchema,
    options,
  );
  const requirements = extracted.requirements.map((requirement) => ({
    ...requirement,
    sourceQuoteValid: quoteExists(requirement.sourceQuote, input.guideline),
  }));

  const mapped = await callJSON(
    mappingsSystemPrompt,
    mappingsUserPrompt(extracted.requirements, input.application, input.supportingDocs),
    mappingsResponseSchema,
    options,
  );
  const returnedMappings = new Map(
    mapped.mappings.map((mapping) => [mapping.requirementId, mapping]),
  );
  const mappings = requirements.map((requirement) => {
    const mapping = returnedMappings.get(requirement.id);
    return postProcessMapping(
      mapping ?? missingMapping(requirement.id),
      input.application,
    );
  });

  const claims = await callJSON(
    unsupportedClaimsSystemPrompt,
    unsupportedClaimsUserPrompt(input.application, input.supportingDocs),
    unsupportedClaimsResponseSchema,
    options,
  );
  const unsupportedClaims = claims.claims.map((claim) => ({
    ...claim,
    quoteValid: quoteExists(claim.quote, input.application),
  }));

  return { requirements, mappings, unsupportedClaims };
}
