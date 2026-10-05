import { z } from "zod";

export const requirementTypeSchema = z.enum(["mandatory", "recommended"]);

export const evidenceStrengthSchema = z.enum([
  "strong",
  "weak",
  "ambiguous",
  "missing",
]);

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: requirementTypeSchema,
  category: z.string().min(1),
  sourceQuote: z.string().min(1),
});

export const requirementsResponseSchema = z.object({
  requirements: z.array(requirementSchema),
});

export const mappingSchema = z.object({
  requirementId: z.string().min(1),
  applicationQuote: z.string().nullable(),
  evidenceStrength: evidenceStrengthSchema,
  reasoning: z.string().min(1),
  neededDocuments: z.array(z.string()),
  clarificationQuestions: z.array(z.string()),
});

export const mappingsResponseSchema = z.object({
  mappings: z.array(mappingSchema),
});

export const unsupportedClaimSchema = z.object({
  claim: z.string().min(1),
  quote: z.string().min(1),
  reason: z.string().min(1),
});

export const unsupportedClaimsResponseSchema = z.object({
  claims: z.array(unsupportedClaimSchema),
});

export type ExtractedRequirement = z.infer<typeof requirementSchema>;
export type SuggestedMapping = z.infer<typeof mappingSchema>;
export type SuggestedUnsupportedClaim = z.infer<typeof unsupportedClaimSchema>;
