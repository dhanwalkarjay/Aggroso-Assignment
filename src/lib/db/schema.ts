import { randomUUID } from "node:crypto";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(randomUUID);
const timestamp = () =>
  text("created_at").notNull().$defaultFn(() => new Date().toISOString());

export const assessments = sqliteTable("assessments", {
  id: id(),
  title: text("title").notNull(),
  createdAt: timestamp(),
});

export const documents = sqliteTable("documents", {
  id: id(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id),
  kind: text("kind", { enum: ["guideline", "application"] }).notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp(),
});

export const analysisRuns = sqliteTable("analysis_runs", {
  id: id(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id),
  guidelineDocId: text("guideline_doc_id")
    .notNull()
    .references(() => documents.id),
  applicationDocId: text("application_doc_id")
    .notNull()
    .references(() => documents.id),
  guidelineHash: text("guideline_hash").notNull(),
  applicationHash: text("application_hash").notNull(),
  status: text("status", { enum: ["running", "complete", "failed"] }).notNull(),
  error: text("error"),
  createdAt: timestamp(),
});

export const requirements = sqliteTable("requirements", {
  id: id(),
  runId: text("run_id")
    .notNull()
    .references(() => analysisRuns.id),
  text: text("text").notNull(),
  type: text("type", { enum: ["mandatory", "recommended"] }).notNull(),
  category: text("category").notNull(),
  sourceQuote: text("source_quote").notNull(),
  sourceQuoteValid: integer("source_quote_valid", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const mappings = sqliteTable(
  "mappings",
  {
    id: id(),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => requirements.id),
    applicationQuote: text("application_quote"),
    citationValid: integer("citation_valid", { mode: "boolean" })
      .notNull()
      .default(false),
    evidenceStrength: text("evidence_strength", {
      enum: ["strong", "weak", "ambiguous", "missing"],
    }).notNull(),
    reasoning: text("reasoning").notNull(),
    userStatus: text("user_status", {
      enum: ["suggested", "confirmed", "corrected", "rejected"],
    }).notNull(),
    correctedQuote: text("corrected_quote"),
    correctedQuoteValid: integer("corrected_quote_valid", { mode: "boolean" }),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    requirementUnique: uniqueIndex("mappings_requirement_id_unique").on(
      table.requirementId,
    ),
  }),
);

export const questions = sqliteTable("questions", {
  id: id(),
  requirementId: text("requirement_id")
    .notNull()
    .references(() => requirements.id),
  text: text("text").notNull(),
});

export const unsupportedClaims = sqliteTable("unsupported_claims", {
  id: id(),
  runId: text("run_id")
    .notNull()
    .references(() => analysisRuns.id),
  claim: text("claim").notNull(),
  quote: text("quote").notNull(),
  quoteValid: integer("quote_valid", { mode: "boolean" })
    .notNull()
    .default(false),
  reason: text("reason").notNull(),
});

export const supportingDocs = sqliteTable("supporting_docs", {
  id: id(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status", { enum: ["provided", "missing"] }).notNull(),
  linkedRequirementId: text("linked_requirement_id").references(
    () => requirements.id,
  ),
});
