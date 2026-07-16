import { ActorIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { AuthenticationPort } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import type { OAuthService } from "./service.js";

export type OAuthClientKindResolver = (clientId: string) => Promise<"codex" | "claude">;

export class OAuthBearerAuthenticator implements AuthenticationPort {
  constructor(private readonly oauth: OAuthService, private readonly resolveClientKind: OAuthClientKindResolver) {}

  async authenticate(authorization: string | undefined): Promise<Principal> {
    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      throw new AppError("AUTH_REQUIRED", "Authentication is required");
    }
    const identity = await this.oauth.authenticate(authorization.slice(7));
    if (identity === null) throw new AppError("AUTH_REQUIRED", "The access grant is invalid or expired");
    return {
      userId: identity.userId,
      actorId: ActorIdSchema.parse(identity.actorId),
      displayName: identity.displayName,
      scopes: new Set(identity.scopes),
      client: await this.resolveClientKind(identity.clientId),
    };
  }
}
