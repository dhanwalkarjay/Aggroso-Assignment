import Groq from "groq-sdk";
import { z } from "zod";

import { logger } from "../logger";

const MODEL = "llama-3.3-70b-versatile";
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAYS = [1500, 3000];

type ErrorWithDetails = {
  status?: number;
  headers?: Headers | Record<string, string | undefined>;
};

export type CallJsonOptions = {
  sleep?: (milliseconds: number) => Promise<void>;
};

export class AiServiceError extends Error {
  readonly code = "AI_UNAVAILABLE";

  constructor(message = "AI service request failed") {
    super(message);
    this.name = "AiServiceError";
  }
}

const getClient = () =>
  new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

const getStatus = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as ErrorWithDetails).status
    : undefined;

const getRetryAfterMilliseconds = (error: unknown) => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("headers" in error) ||
    !error.headers
  ) {
    return undefined;
  }

  const headers = (error as ErrorWithDetails).headers;
  if (!headers) {
    return undefined;
  }

  const value =
    headers instanceof Headers
      ? headers.get("retry-after")
      : headers["retry-after"];

  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMilliseconds = Date.parse(value) - Date.now();
  return Number.isFinite(dateMilliseconds)
    ? Math.max(0, dateMilliseconds)
    : undefined;
};

const isRetryableError = (error: unknown) => {
  const status = getStatus(error);
  return (
    error instanceof SyntaxError ||
    error instanceof z.ZodError ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function callJSON<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
  options: CallJsonOptions = {},
): Promise<T> {
  const client = getClient();
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    let status: number | undefined;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      status = 200;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new SyntaxError("AI response did not contain JSON content");
      }

      const parsed = schema.parse(JSON.parse(content));
      logger.info(
        {
          attempt,
          status,
          durationMs: Date.now() - startedAt,
          tokenUsage: response.usage?.total_tokens,
        },
        "AI JSON request succeeded",
      );
      return parsed;
    } catch (error) {
      status = status ?? getStatus(error);
      logger.warn(
        {
          attempt,
          status,
          durationMs: Date.now() - startedAt,
        },
        "AI JSON request failed",
      );

      if (attempt === MAX_ATTEMPTS || !isRetryableError(error)) {
        throw new AiServiceError();
      }

      const delay =
        getRetryAfterMilliseconds(error) ?? DEFAULT_RETRY_DELAYS[attempt - 1];
      await sleep(delay);
    }
  }

  throw new AiServiceError();
}
