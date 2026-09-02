/**
 * Application error taxonomy.
 *
 * Every error that can reach an API route carries a stable machine code, an
 * HTTP status and a message that is safe to show to an end user. Anything else
 * (stack traces, provider payloads, credential details) stays server-side.
 */

export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "pass_expired"
  | "configuration_missing"
  | "invalid_credentials"
  | "pass_generation_failed"
  | "provider_error"
  | "database_error"
  | "internal_error";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  pass_expired: 409,
  configuration_missing: 503,
  invalid_credentials: 503,
  pass_generation_failed: 500,
  provider_error: 502,
  database_error: 500,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Message that is safe to render in the UI. */
  readonly userMessage: string;
  /** Internal detail for server logs only. Never serialised to the client. */
  readonly detail?: unknown;

  constructor(
    code: AppErrorCode,
    userMessage: string,
    options?: { detail?: unknown; cause?: unknown },
  ) {
    super(userMessage, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.userMessage = userMessage;
    this.detail = options?.detail;
  }
}

export const unauthorized = (message = "You need an active session to do that.") =>
  new AppError("unauthorized", message);

export const forbidden = (message = "You do not have access to this pass.") =>
  new AppError("forbidden", message);

export const notFound = (message = "That pass could not be found.") =>
  new AppError("not_found", message);

export const invalidRequest = (message: string, detail?: unknown) =>
  new AppError("invalid_request", message, { detail });

export const passExpired = (message = "This pass has expired and can no longer be added to a wallet.") =>
  new AppError("pass_expired", message);

export const configurationMissing = (message: string, detail?: unknown) =>
  new AppError("configuration_missing", message, { detail });

export const invalidCredentials = (message: string, detail?: unknown) =>
  new AppError("invalid_credentials", message, { detail });

export const passGenerationFailed = (message: string, cause?: unknown) =>
  new AppError("pass_generation_failed", message, { cause });

export const providerError = (message: string, detail?: unknown) =>
  new AppError("provider_error", message, { detail });

export const databaseError = (message: string, detail?: unknown) =>
  new AppError("database_error", message, { detail });

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Normalises any thrown value into an AppError without leaking internals. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError("internal_error", "Something went wrong. Please try again.", {
    cause: error,
  });
}
