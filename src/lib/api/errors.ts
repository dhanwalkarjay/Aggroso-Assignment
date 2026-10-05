import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger } from "../logger";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const getRequestId = (request: Request) =>
  request.headers.get("x-request-id") ?? randomUUID();

export const errorResponse = (error: unknown, requestId: string) => {
  if (error instanceof ApiError) {
    logger.warn(
      { requestId, code: error.code, status: error.status },
      "API request rejected",
    );
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }

  if (error instanceof ZodError) {
    logger.warn({ requestId, code: "INVALID_INPUT", status: 400 }, "API input rejected");
    return NextResponse.json(
      { error: "Invalid request input", code: "INVALID_INPUT" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  logger.error({ requestId, error }, "Unexpected API error");
  return NextResponse.json(
    { error: "An unexpected error occurred", code: "INTERNAL_ERROR" },
    { status: 500, headers: { "x-request-id": requestId } },
  );
};

export const withRequestId = (response: NextResponse, requestId: string) => {
  response.headers.set("x-request-id", requestId);
  return response;
};
