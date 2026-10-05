import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import { parseBody, addSupportingDocumentSchema } from "@/lib/api/validate";
import { db } from "@/lib/db/client";
import { assessments, supportingDocs } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseBody(request, addSupportingDocumentSchema);
    const [assessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.id, body.assessmentId))
      .limit(1);
    if (!assessment) {
      throw new ApiError("Assessment not found", "NOT_FOUND", 404);
    }

    const [document] = await db
      .insert(supportingDocs)
      .values({
        assessmentId: body.assessmentId,
        name: body.name,
        type: body.type,
        status: body.status,
      })
      .returning();
    if (!document) {
      throw new Error("Supporting document insert failed");
    }

    return withRequestId(NextResponse.json(document, { status: 201 }), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
