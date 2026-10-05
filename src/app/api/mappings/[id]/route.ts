import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, getRequestId, withRequestId } from "@/lib/api/errors";
import { parseBody, mappingActionSchema } from "@/lib/api/validate";
import { db } from "@/lib/db/client";
import { analysisRuns, documents, mappings, requirements } from "@/lib/db/schema";
import { quoteExists } from "@/lib/logic/citations";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { id } = await context.params;
    const body = await parseBody(request, mappingActionSchema);
    const [mapping] = await db
      .select({
        id: mappings.id,
        application: documents.content,
      })
      .from(mappings)
      .innerJoin(requirements, eq(requirements.id, mappings.requirementId))
      .innerJoin(analysisRuns, eq(analysisRuns.id, requirements.runId))
      .innerJoin(documents, eq(documents.id, analysisRuns.applicationDocId))
      .where(
        and(eq(mappings.id, id), eq(documents.kind, "application")),
      )
      .limit(1);
    if (!mapping) {
      throw new ApiError("Mapping not found", "NOT_FOUND", 404);
    }

    const update =
      body.action === "confirm"
        ? {
            userStatus: "confirmed" as const,
            updatedAt: new Date().toISOString(),
          }
        : body.action === "reject"
          ? {
              userStatus: "rejected" as const,
              updatedAt: new Date().toISOString(),
            }
          : {
              userStatus: "corrected" as const,
              correctedQuote: body.quote,
              correctedQuoteValid: quoteExists(body.quote, mapping.application),
              updatedAt: new Date().toISOString(),
            };

    if (body.action === "correct" && !update.correctedQuoteValid) {
      throw new ApiError(
        "The corrected quote was not found in the application",
        "QUOTE_NOT_FOUND",
        422,
      );
    }

    const [updated] = await db
      .update(mappings)
      .set(update)
      .where(eq(mappings.id, id))
      .returning();
    if (!updated) {
      throw new Error("Mapping update failed");
    }

    return withRequestId(NextResponse.json(updated), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
