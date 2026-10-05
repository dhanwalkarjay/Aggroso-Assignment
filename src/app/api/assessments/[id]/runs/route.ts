import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import { db } from "@/lib/db/client";
import { analysisRuns, assessments, documents } from "@/lib/db/schema";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { id: assessmentId } = await context.params;
    const [assessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!assessment) {
      throw new ApiError("Assessment not found", "NOT_FOUND", 404);
    }

    const runs = await db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.assessmentId, assessmentId))
      .orderBy(desc(analysisRuns.createdAt));
    const result = await Promise.all(
      runs.map(async (run) => {
        const [guideline, application] = await Promise.all([
          db
            .select({ version: documents.version })
            .from(documents)
            .where(eq(documents.id, run.guidelineDocId))
            .limit(1),
          db
            .select({ version: documents.version })
            .from(documents)
            .where(eq(documents.id, run.applicationDocId))
            .limit(1),
        ]);
        return {
          id: run.id,
          createdAt: run.createdAt,
          status: run.status,
          error: run.error,
          guidelineVersion: guideline[0]?.version ?? null,
          applicationVersion: application[0]?.version ?? null,
        };
      }),
    );

    return withRequestId(NextResponse.json(result), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
