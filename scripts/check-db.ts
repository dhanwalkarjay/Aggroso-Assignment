import { eq } from "drizzle-orm";

import { logger } from "../src/lib/logger";
import { db } from "../src/lib/db/client";
import { assessments, documents } from "../src/lib/db/schema";

const assessmentTitle = `Phase 1 smoke test ${new Date().toISOString()}`;

async function main() {
  const [assessment] = await db
    .insert(assessments)
    .values({ title: assessmentTitle })
    .returning();

  if (!assessment) {
    throw new Error("The assessment insert did not return a row");
  }

  const [document] = await db
    .insert(documents)
    .values({
      assessmentId: assessment.id,
      kind: "guideline",
      version: 1,
      content: "A sample guideline for the database smoke test.",
      contentHash: "phase-1-smoke-test",
    })
    .returning();

  if (!document) {
    throw new Error("The document insert did not return a row");
  }

  const rows = await db
    .select({
      assessmentTitle: assessments.title,
      documentKind: documents.kind,
    })
    .from(assessments)
    .innerJoin(documents, eq(documents.assessmentId, assessments.id))
    .where(eq(assessments.id, assessment.id));

  if (rows.length !== 1 || rows[0]?.assessmentTitle !== assessmentTitle) {
    throw new Error("The inserted rows could not be read back");
  }

  logger.info(
    {
      assessmentId: assessment.id,
      documentId: document.id,
      rowsRead: rows.length,
    },
    "Database smoke test passed",
  );
}

void main();
