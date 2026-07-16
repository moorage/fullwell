import type { ErrorCode } from "./types.js";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable = false,
    readonly retryAfterSeconds: number | null = null,
    readonly fieldErrors: ReadonlyArray<{ field: string; message: string }> = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function invariant(condition: boolean, code: ErrorCode, message: string): asserts condition {
  if (!condition) throw new AppError(code, message);
}
