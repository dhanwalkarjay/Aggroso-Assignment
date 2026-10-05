import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  ApiError,
  errorResponse,
  getRequestId,
  withRequestId,
} from "@/lib/api/errors";
import { parseBody, createDocumentSchema } from "@/lib/api/validate";
import { db } from "@/lib/db/client";
import { assessments, documents } from "@/lib/db/schema";
import { hashText } from "@/lib/logic/stale";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseBody(request, createDocumentSchema);
    const contentHash = hashText(body.content);
    const result = await db.transaction(async (tx) => {
      const [assessment] = await tx
        .select({ id: assessments.id })
        .from(assessments)
        .where(eq(assessments.id, body.assessmentId))
        .limit(1);
      if (!assessment) {
        throw new ApiError("Assessment not found", "NOT_FOUND", 404);
      }

      const [latest] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.assessmentId, body.assessmentId),
            eq(documents.kind, body.kind),
          ),
        )
        .orderBy(desc(documents.version))
        .limit(1);

      if (latest?.contentHash === contentHash) {
        return { id: latest.id, version: latest.version, changed: false };
      }

      const [created] = await tx
        .insert(documents)
        .values({
          assessmentId: body.assessmentId,
          kind: body.kind,
          version: (latest?.version ?? 0) + 1,
          content: body.content,
          contentHash,
        })
        .returning({ id: documents.id, version: documents.version });
      if (!created) {
        throw new Error("Document insert failed");
      }

      return { ...created, changed: true };
    });

    return withRequestId(NextResponse.json(result), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
