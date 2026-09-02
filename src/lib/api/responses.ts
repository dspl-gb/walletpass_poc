import { NextResponse } from "next/server";

import { toAppError, type AppErrorCode } from "@/lib/wallet/common/errors";

export interface ApiErrorBody {
  error: { code: AppErrorCode; message: string };
}

/**
 * Converts any thrown value into a safe JSON error response.
 *
 * The full error - including causes, provider payloads and stack traces - is
 * logged server-side. The client only receives a stable code and a message that
 * has been written for end users.
 */
export function errorResponse(error: unknown, context: Record<string, unknown> = {}) {
  const appError = toAppError(error);

  const log = appError.status >= 500 ? console.error : console.warn;
  log("[api]", {
    ...context,
    code: appError.code,
    status: appError.status,
    message: appError.message,
    detail: appError.detail,
    cause: appError.cause,
    stack: appError.stack,
  });

  return NextResponse.json<ApiErrorBody>(
    { error: { code: appError.code, message: appError.userMessage } },
    { status: appError.status },
  );
}

export function jsonResponse<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}
