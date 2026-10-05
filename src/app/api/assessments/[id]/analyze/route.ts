import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  ApiError,
  errorResponse,
  getRequestId,
  withRequestId,
} from "@/lib/api/errors";
import { db } from "@/lib/db/client";
import {
  analysisRuns,
  assessments,
  documents,
  mappings,
  questions,
  requirements,
  supportingDocs,
  unsupportedClaims,
} from "@/lib/db/schema";
import { AiServiceError } from "@/lib/ai/groq";
import {
  PipelineInputError,
  runPipeline,
} from "@/lib/ai/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id: assessmentId } = await context.params;
  let runId: string | undefined;

  try {
    const [assessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!assessment) {
      throw new ApiError("Assessment not found", "NOT_FOUND", 404);
    }

    const [running] = await db
      .select({ id: analysisRuns.id })
      .from(analysisRuns)
      .where(
        and(
          eq(analysisRuns.assessmentId, assessmentId),
          eq(analysisRuns.status, "running"),
        ),
      )
      .limit(1);
    if (running) {
      throw new ApiError(
        "An analysis is already running for this assessment",
        "ALREADY_RUNNING",
        409,
      );
    }

    const [guideline, application] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.assessmentId, assessmentId),
            eq(documents.kind, "guideline"),
          ),
        )
        .orderBy(desc(documents.version))
        .limit(1),
      db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.assessmentId, assessmentId),
            eq(documents.kind, "application"),
          ),
        )
        .orderBy(desc(documents.version))
        .limit(1),
    ]);
    if (!guideline[0] || !application[0]) {
      throw new ApiError(
        "Assessment documents are incomplete",
        "DOCUMENTS_NOT_FOUND",
        400,
      );
    }

    const [run] = await db
      .insert(analysisRuns)
      .values({
        assessmentId,
        guidelineDocId: guideline[0].id,
        applicationDocId: application[0].id,
        guidelineHash: guideline[0].contentHash,
        applicationHash: application[0].contentHash,
        status: "running",
      })
      .returning({ id: analysisRuns.id });
    if (!run) {
      throw new Error("Analysis run insert failed");
    }
    const createdRunId = run.id;
    runId = createdRunId;

    const documentMetadata = await db
      .select({
        name: supportingDocs.name,
        type: supportingDocs.type,
        status: supportingDocs.status,
      })
      .from(supportingDocs)
      .where(eq(supportingDocs.assessmentId, assessmentId));

    const result = await runPipeline({
      guideline: guideline[0].content,
      application: application[0].content,
      supportingDocs: documentMetadata,
    });

    await db.transaction(async (tx) => {
      const requirementIds = new Map<string, string>();
      for (const requirement of result.requirements) {
        const [created] = await tx
          .insert(requirements)
          .values({
            runId: createdRunId,
            text: requirement.text,
            type: requirement.type,
            category: requirement.category,
            sourceQuote: requirement.sourceQuote,
            sourceQuoteValid: requirement.sourceQuoteValid,
          })
          .returning({ id: requirements.id });
        if (!created) {
          throw new Error("Requirement insert failed");
        }
        requirementIds.set(requirement.id, created.id);
      }

      for (const mapping of result.mappings) {
        const requirementId = requirementIds.get(mapping.requirementId);
        if (!requirementId) {
          continue;
        }
        await tx.insert(mappings).values({
          requirementId,
          applicationQuote: mapping.applicationQuote,
          citationValid: mapping.citationValid,
          evidenceStrength: mapping.evidenceStrength,
          reasoning: mapping.reasoning,
          userStatus: "suggested",
        });
        if (mapping.clarificationQuestions.length > 0) {
          await tx.insert(questions).values(
            mapping.clarificationQuestions.map((text) => ({
              requirementId,
              text,
            })),
          );
        }
      }

      if (result.unsupportedClaims.length > 0) {
        await tx.insert(unsupportedClaims).values(
          result.unsupportedClaims.map((claim) => ({
            runId: createdRunId,
            claim: claim.claim,
            quote: claim.quote,
            quoteValid: claim.quoteValid,
            reason: claim.reason,
          })),
        );
      }

      await tx
        .update(analysisRuns)
        .set({ status: "complete", error: null })
        .where(eq(analysisRuns.id, createdRunId));
    });

    return withRequestId(
      NextResponse.json({ id: runId, status: "complete" }),
      requestId,
    );
  } catch (error) {
    if (runId) {
      await db
        .update(analysisRuns)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Analysis failed",
        })
        .where(eq(analysisRuns.id, runId));
    }

    if (error instanceof PipelineInputError) {
      return errorResponse(
        new ApiError(error.message, error.code, 400),
        requestId,
      );
    }
    if (error instanceof AiServiceError) {
      return errorResponse(
        new ApiError(
          "AI service is busy, please try again",
          "AI_UNAVAILABLE",
          503,
        ),
        requestId,
      );
    }
    return errorResponse(error, requestId);
  }
}
