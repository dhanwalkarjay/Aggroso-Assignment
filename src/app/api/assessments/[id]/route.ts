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

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { id: assessmentId } = await context.params;
    const requestedRunId = new URL(request.url).searchParams.get("runId");
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!assessment) {
      throw new ApiError("Assessment not found", "NOT_FOUND", 404);
    }

    const [latestGuideline, latestApplication, latestRun] = await Promise.all([
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
      db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.assessmentId, assessmentId))
        .orderBy(desc(analysisRuns.createdAt))
        .limit(1),
    ]);

    const selectedRun = requestedRunId
      ? (
          await db
            .select()
            .from(analysisRuns)
            .where(
              and(
                eq(analysisRuns.id, requestedRunId),
                eq(analysisRuns.assessmentId, assessmentId),
              ),
            )
            .limit(1)
        )[0]
      : latestRun[0];

    if (requestedRunId && !selectedRun) {
      throw new ApiError("Analysis run not found", "NOT_FOUND", 404);
    }

    const [supporting, runRequirements] = await Promise.all([
      db.select().from(supportingDocs).where(eq(supportingDocs.assessmentId, assessmentId)),
      selectedRun
        ? db
            .select()
            .from(requirements)
            .where(eq(requirements.runId, selectedRun.id))
        : Promise.resolve([]),
    ]);
    const requirementIds = runRequirements.map((requirement) => requirement.id);
    const [runMappings, runQuestions, claims] = selectedRun
      ? await Promise.all([
          requirementIds.length > 0
            ? db.select().from(mappings).where(inArray(mappings.requirementId, requirementIds))
            : Promise.resolve([]),
          requirementIds.length > 0
            ? db.select().from(questions).where(inArray(questions.requirementId, requirementIds))
            : Promise.resolve([]),
          db.select().from(unsupportedClaims).where(eq(unsupportedClaims.runId, selectedRun.id)),
        ])
      : [[], [], []];

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
    const stale = selectedRun
      ? selectedRun.id !== latestRun[0]?.id ||
        !latestGuideline[0] ||
        !latestApplication[0] ||
        isStale(selectedRun, {
          guidelineHash: latestGuideline[0]?.contentHash ?? "",
          applicationHash: latestApplication[0]?.contentHash ?? "",
        })
      : false;

    return withRequestId(
      NextResponse.json({
        assessment,
        run: selectedRun ?? null,
        requirements: runRequirements.map((requirement) => ({
          ...requirement,
          mapping: mappingByRequirement.get(requirement.id) ?? null,
          questions: runQuestions.filter(
            (question) => question.requirementId === requirement.id,
          ),
        })),
        unsupportedClaims: claims,
        completion: completion(completionRows),
        missingDocs: missing,
        stale,
        latestDocuments: {
          guideline: latestGuideline[0] ?? null,
          application: latestApplication[0] ?? null,
        },
        supportingDocs: supporting,
      }),
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
