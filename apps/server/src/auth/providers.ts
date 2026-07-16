import { AppError } from "../core/errors.js";
import type { PasskeyProvider } from "./types.js";

export class UnsupportedPasskeyProvider implements PasskeyProvider {
  async beginAuthentication(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey sign-in is not configured");
  }

  async completeAuthentication(): Promise<never> {
    throw new AppError("PROVIDER_UNAVAILABLE", "Passkey sign-in is not configured");
  }
}
