import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import { parseBody, supportingDocumentStatusSchema } from "@/lib/api/validate";
import { db } from "@/lib/db/client";
import { supportingDocs } from "@/lib/db/schema";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { id } = await context.params;
    const body = await parseBody(request, supportingDocumentStatusSchema);
    const [document] = await db
      .update(supportingDocs)
      .set({ status: body.status })
      .where(eq(supportingDocs.id, id))
      .returning();
    if (!document) {
      throw new ApiError("Supporting document not found", "NOT_FOUND", 404);
    }

    return withRequestId(NextResponse.json(document), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
