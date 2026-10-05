import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import {
  createAssessmentSchema,
  parseBody,
} from "@/lib/api/validate";
import { db } from "@/lib/db/client";
import {
  analysisRuns,
  assessments,
  documents,
  supportingDocs,
} from "@/lib/db/schema";
import { hashText, isStale } from "@/lib/logic/stale";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseBody(request, createAssessmentSchema);
    const result = await db.transaction(async (tx) => {
      const [assessment] = await tx
        .insert(assessments)
        .values({ title: body.title })
        .returning();
      if (!assessment) {
        throw new Error("Assessment insert failed");
      }

      await tx.insert(documents).values([
        {
          assessmentId: assessment.id,
          kind: "guideline",
          version: 1,
          content: body.guideline,
          contentHash: hashText(body.guideline),
        },
        {
          assessmentId: assessment.id,
          kind: "application",
          version: 1,
          content: body.application,
          contentHash: hashText(body.application),
        },
      ]);

      if (body.supportingDocs.length > 0) {
        await tx.insert(supportingDocs).values(
          body.supportingDocs.map((document) => ({
            assessmentId: assessment.id,
            name: document.name,
            type: document.type,
            status: document.status,
          })),
        );
      }

      return assessment;
    });

    return withRequestId(
      NextResponse.json({ id: result.id }, { status: 201 }),
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const rows = await db.select().from(assessments).orderBy(desc(assessments.createdAt));
    const results = await Promise.all(
      rows.map(async (assessment) => {
        const [latestGuideline, latestApplication, latestRun] = await Promise.all([
          db
            .select({ contentHash: documents.contentHash })
            .from(documents)
            .where(
              and(
                eq(documents.assessmentId, assessment.id),
                eq(documents.kind, "guideline"),
              ),
            )
            .orderBy(desc(documents.version))
            .limit(1),
          db
            .select({ contentHash: documents.contentHash })
            .from(documents)
            .where(
              and(
                eq(documents.assessmentId, assessment.id),
                eq(documents.kind, "application"),
              ),
            )
            .orderBy(desc(documents.version))
            .limit(1),
          db
            .select({
              guidelineHash: analysisRuns.guidelineHash,
              applicationHash: analysisRuns.applicationHash,
            })
            .from(analysisRuns)
            .where(eq(analysisRuns.assessmentId, assessment.id))
            .orderBy(desc(analysisRuns.createdAt))
            .limit(1),
        ]);

        const stale =
          latestRun.length > 0 &&
          latestGuideline.length > 0 &&
          latestApplication.length > 0 &&
          isStale(latestRun[0], {
            guidelineHash: latestGuideline[0].contentHash,
            applicationHash: latestApplication[0].contentHash,
          });

        return {
          id: assessment.id,
          title: assessment.title,
          createdAt: assessment.createdAt,
          stale,
        };
      }),
    );

    return withRequestId(NextResponse.json(results), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
