export type RequirementType = "mandatory" | "recommended";

export type UserStatus =
  | "suggested"
  | "confirmed"
  | "corrected"
  | "rejected";

export type CompletionRow = {
  type: RequirementType;
  userStatus: UserStatus;
  citationValid: boolean;
  correctedQuoteValid?: boolean | null;
};

export const isSatisfied = (row: CompletionRow) =>
  (row.userStatus === "confirmed" && row.citationValid) ||
  (row.userStatus === "corrected" && row.correctedQuoteValid === true);

export function completion(rows: CompletionRow[]) {
  const calculate = (type: RequirementType) => {
    const matchingRows = rows.filter((row) => row.type === type);
    const done = matchingRows.filter(isSatisfied).length;

    return {
      done,
      total: matchingRows.length,
      pct: matchingRows.length
        ? Math.round((done / matchingRows.length) * 100)
        : 0,
    };
  };

  return {
    mandatory: calculate("mandatory"),
    recommended: calculate("recommended"),
  };
}
