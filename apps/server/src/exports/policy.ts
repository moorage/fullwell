import { AppError } from "../core/errors.js";

export const MAX_EXPORT_BYTES = 96 * 1024 * 1024;

export function assertExportSize(bytes: number, maximum = MAX_EXPORT_BYTES): void {
  if (bytes > maximum) throw new AppError("VALIDATION_FAILED", "Household export exceeds the 96 MiB download limit");
}
