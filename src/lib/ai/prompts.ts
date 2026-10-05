const sharedSystemRule = `
Respond with valid JSON only. Quote only text that appears verbatim in the provided source. If you are unsure or no supporting text exists, return null for the quote. Never state or imply whether the applicant is eligible or will be funded. You assess completeness of evidence only.
`;

export const requirementsSystemPrompt = `You extract grant guideline requirements.${sharedSystemRule}`;

export const requirementsUserPrompt = (guideline: string) => `
Extract every distinct requirement from this grant guideline.

Classify wording as mandatory only when it clearly uses must, shall, required, eligibility conditions, deadlines, or mandatory attachments. Classify should, may, encouraged, and preferred wording as recommended. If wording is ambiguous, classify it as recommended and explain the uncertainty in category. Use IDs such as R1, R2. sourceQuote must be copied verbatim from the guideline.

Return exactly one JSON object with a requirements array. Every array item must contain all five keys: id (string), text (string describing the requirement), type (exactly mandatory or recommended), category (string), and sourceQuote (string copied verbatim from the guideline). Do not omit text or type.

GUIDELINE:
${guideline}
`;

export const mappingsSystemPrompt = `You map grant requirements to draft application evidence and identify clarification needs.${sharedSystemRule}`;

export const mappingsUserPrompt = (
  requirements: unknown,
  application: string,
  supportingDocs: unknown[],
) => `
For each requirement, assess the draft application. Return one mapping for each requirement using its exact requirementId.

Use strong only when the requirement is directly and specifically addressed. Use weak when it is vague or lacks specifics. Use ambiguous when it could be read multiple ways or conflicts. Use missing when there is no evidence; missing mappings must have a null applicationQuote. Include neededDocuments when a supporting document is needed. Generate one or two clarificationQuestions only for weak, ambiguous, or missing evidence.

Return exactly one JSON object with a mappings array. Every array item must contain all six keys: requirementId (string copied from the input), applicationQuote (string or null), evidenceStrength (exactly strong, weak, ambiguous, or missing), reasoning (string), neededDocuments (array of strings), and clarificationQuestions (array of strings). Return one item for every input requirement.

REQUIREMENTS JSON:
${JSON.stringify(requirements)}

APPLICATION:
${application}

SUPPORTING DOCUMENT METADATA JSON:
${JSON.stringify(supportingDocs)}
`;

export const unsupportedClaimsSystemPrompt = `You identify claims in a draft application that have no supplied evidence.${sharedSystemRule}`;

export const unsupportedClaimsUserPrompt = (
  application: string,
  supportingDocs: unknown[],
) => `
Find claims about statistics, outcomes, partnerships, credentials, or past performance that are not supported by evidence in the application text or supplied supporting-document metadata. Quote the claim verbatim from the application. Do not infer unsupported claims from ordinary aspirations or plans.

Return exactly one JSON object with a claims array. Every array item must contain all three keys: claim (string), quote (string copied verbatim from the application), and reason (string explaining why supplied evidence does not support it). Return an empty claims array when no unsupported claim is found.

APPLICATION:
${application}

SUPPORTING DOCUMENT METADATA JSON:
${JSON.stringify(supportingDocs)}
`;
