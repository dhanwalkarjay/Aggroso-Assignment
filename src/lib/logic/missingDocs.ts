export type SupportingDocumentStatus = "provided" | "missing";

export type SupportingDocument = {
  id: string;
  name: string;
  type: string;
  status: SupportingDocumentStatus;
  linkedRequirementId: string | null;
};

export type DocumentRequirement = {
  id: string;
  type: "mandatory" | "recommended";
  needsSupportingDocument: boolean;
};

export type MissingDocumentsResult = {
  missing: SupportingDocument[];
  missingMandatoryRequirementCount: number;
};

export function missingDocs(
  supportingDocuments: SupportingDocument[],
  requirements: DocumentRequirement[],
): MissingDocumentsResult {
  const missing = supportingDocuments.filter(
    (document) => document.status === "missing",
  );
  const missingMandatoryRequirementCount = requirements.filter(
    (requirement) =>
      requirement.type === "mandatory" &&
      requirement.needsSupportingDocument &&
      !supportingDocuments.some(
        (document) =>
          document.linkedRequirementId === requirement.id &&
          document.status === "provided",
      ),
  ).length;

  return { missing, missingMandatoryRequirementCount };
}
