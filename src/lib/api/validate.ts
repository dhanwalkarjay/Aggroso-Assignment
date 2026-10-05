import { z } from "zod";

import { ApiError } from "./errors";

export const supportingDocumentInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(100),
  status: z.enum(["provided", "missing"]),
});

export const addSupportingDocumentSchema = supportingDocumentInputSchema.extend({
  assessmentId: z.string().uuid(),
});

export const createAssessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  guideline: z.string().min(1),
  application: z.string().min(1),
  supportingDocs: z.array(supportingDocumentInputSchema).default([]),
});

export const createDocumentSchema = z.object({
  assessmentId: z.string().uuid(),
  kind: z.enum(["guideline", "application"]),
  content: z.string().min(1),
});

export const mappingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("correct"), quote: z.string().min(1) }),
]);

export const supportingDocumentStatusSchema = z.object({
  status: z.enum(["provided", "missing"]),
});

export const parseBody = async <T>(request: Request, schema: z.ZodType<T>) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON", "INVALID_JSON", 400);
  }
  return schema.parse(body);
};
