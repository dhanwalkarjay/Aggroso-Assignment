import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import { db } from "@/lib/db/client";
import { analysisRuns, assessments, documents, mappings, questions, requirements, supportingDocs, unsupportedClaims } from "@/lib/db/schema";
import { completion } from "@/lib/logic/completion";
import { missingDocs } from "@/lib/logic/missingDocs";
import { isStale } from "@/lib/logic/stale";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const disclaimer =
  "This is a completeness aid, not a legal or funding-eligibility decision. Confirm all requirements with the funder.";

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { id: assessmentId } = await context.params;
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!assessment) {
      throw new ApiError("Assessment not found", "NOT_FOUND", 404);
    }

    const [run] = await db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.assessmentId, assessmentId))
      .orderBy(desc(analysisRuns.createdAt))
      .limit(1);
    if (!run) {
      throw new ApiError("No analysis run found", "NOT_FOUND", 404);
    }

    const [guideline, application, runRequirements, supporting, claims] = await Promise.all([
      db.select().from(documents).where(eq(documents.id, run.guidelineDocId)).limit(1),
      db.select().from(documents).where(eq(documents.id, run.applicationDocId)).limit(1),
      db.select().from(requirements).where(eq(requirements.runId, run.id)),
      db.select().from(supportingDocs).where(eq(supportingDocs.assessmentId, assessmentId)),
      db.select().from(unsupportedClaims).where(eq(unsupportedClaims.runId, run.id)),
    ]);
    const requirementIds = runRequirements.map((requirement) => requirement.id);
    const [runMappings, runQuestions] = requirementIds.length
      ? await Promise.all([
          db.select().from(mappings).where(inArray(mappings.requirementId, requirementIds)),
          db.select().from(questions).where(inArray(questions.requirementId, requirementIds)),
        ])
      : [[], []];
    const mappingByRequirement = new Map(
      runMappings.map((mapping) => [mapping.requirementId, mapping]),
    );
    const completionRows = runRequirements.flatMap((requirement) => {
      const mapping = mappingByRequirement.get(requirement.id);
      return mapping
        ? [{
            type: requirement.type,
            userStatus: mapping.userStatus,
            citationValid: mapping.citationValid,
            correctedQuoteValid: mapping.correctedQuoteValid,
          }]
        : [];
    });
    const mandatory = runRequirements
      .filter((requirement) => requirement.type === "mandatory")
      .map((requirement) => ({
        requirement,
        mapping: mappingByRequirement.get(requirement.id) ?? null,
      }));
    const gaps = runRequirements
      .map((requirement) => ({
        requirement,
        mapping: mappingByRequirement.get(requirement.id) ?? null,
      }))
      .filter(
        ({ mapping }) =>
          mapping &&
          ["missing", "weak", "ambiguous"].includes(mapping.evidenceStrength) &&
          mapping.userStatus !== "confirmed" &&
          mapping.userStatus !== "corrected",
      );
    const missing = missingDocs(
      supporting.map((document) => ({
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        linkedRequirementId: document.linkedRequirementId,
      })),
      [],
    );
    const [latestGuideline, latestApplication, latestRun] = await Promise.all([
      db
        .select({ contentHash: documents.contentHash })
        .from(documents)
        .where(and(eq(documents.assessmentId, assessmentId), eq(documents.kind, "guideline")))
        .orderBy(desc(documents.version))
        .limit(1),
      db
        .select({ contentHash: documents.contentHash })
        .from(documents)
        .where(and(eq(documents.assessmentId, assessmentId), eq(documents.kind, "application")))
        .orderBy(desc(documents.version))
        .limit(1),
      db
        .select({ id: analysisRuns.id })
        .from(analysisRuns)
        .where(eq(analysisRuns.assessmentId, assessmentId))
        .orderBy(desc(analysisRuns.createdAt))
        .limit(1),
    ]);

    return withRequestId(
      NextResponse.json({
        assessment,
        guidelineVersion: guideline[0]?.version ?? null,
        applicationVersion: application[0]?.version ?? null,
        runDate: run.createdAt,
        stale:
          run.id !== latestRun[0]?.id ||
          !latestGuideline[0] ||
          !latestApplication[0] ||
          isStale(run, {
            guidelineHash: latestGuideline[0]?.contentHash ?? "",
            applicationHash: latestApplication[0]?.contentHash ?? "",
          }),
        completion: completion(completionRows),
        mandatory: {
          confirmed: mandatory.filter(({ mapping }) => mapping?.userStatus === "confirmed"),
          corrected: mandatory.filter(({ mapping }) => mapping?.userStatus === "corrected"),
          rejected: mandatory.filter(({ mapping }) => mapping?.userStatus === "rejected"),
          unreviewed: mandatory.filter(({ mapping }) => !mapping || mapping.userStatus === "suggested"),
        },
        gaps,
        questions: runQuestions,
        unsupportedClaims: claims,
        missingSupportingDocuments: missing.missing,
        missingMandatoryRequirementCount: missing.missingMandatoryRequirementCount,
        disclaimer,
      }),
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
