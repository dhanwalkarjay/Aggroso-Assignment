import { createHash } from "node:crypto";

export const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

export const hashText = (value: string) =>
  createHash("sha256").update(normalizeText(value)).digest("hex");

export const isStale = (
  run: { guidelineHash: string; applicationHash: string },
  latest: { guidelineHash: string; applicationHash: string },
) =>
  run.guidelineHash !== latest.guidelineHash ||
  run.applicationHash !== latest.applicationHash;
