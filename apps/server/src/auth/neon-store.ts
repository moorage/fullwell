import { ActorIdSchema, UserIdSchema, type UserId } from "@hfj/contracts";
import { z } from "zod";
import type { NeonConnection } from "../persistence/neon.js";
import type { AuthChallenge, AuthStore, AuthUser, WebSession } from "./types.js";

const TimestampSchema = z.union([z.date(), z.string()]).transform((value) => new Date(value).toISOString());
const NullableTimestampSchema = z.union([z.date(), z.string()]).nullable().transform((value) => value === null ? null : new Date(value).toISOString());
const ChallengeRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["magic_link", "apple", "webauthn_registration", "webauthn_authentication"]),
  token_hash: z.string(),
  browser_binding_hash: z.string().nullable(),
  payload: z.record(z.string(), z.string()),
  expires_at: TimestampSchema,
  consumed_at: NullableTimestampSchema,
});
const UserRowSchema = z.object({ id: UserIdSchema, actor_id: ActorIdSchema, display_name: z.string().min(1) });
const SessionRowSchema = z.object({
  id: z.string(), user_id: UserIdSchema, token_hash: z.string(), csrf_hash: z.string(),
  pending_intent: z.string().nullable(), expires_at: TimestampSchema, revoked_at: NullableTimestampSchema,
  actor_id: ActorIdSchema.optional(), display_name: z.string().optional(),
});

export class NeonAuthStore implements AuthStore {
  constructor(private readonly connection: NeonConnection) {}

  async saveChallenge(challenge: AuthChallenge): Promise<void> {
    await this.connection.pooled`
      INSERT INTO auth_challenges (id, kind, token_hash, browser_binding_hash, payload, expires_at, consumed_at)
      VALUES (${challenge.id}, ${challenge.kind}, ${challenge.tokenHash}, ${challenge.browserBindingHash}, ${this.connection.pooled.json(challenge.payload)}, ${challenge.expiresAt}, ${challenge.consumedAt})
    `;
  }

  async consumeChallenge(input: { readonly tokenHash: string; readonly kind: AuthChallenge["kind"]; readonly browserBindingHash: string | null; readonly consumedAt: string }): Promise<AuthChallenge | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE auth_challenges
      SET consumed_at = ${input.consumedAt}
      WHERE token_hash = ${input.tokenHash}
        AND kind = ${input.kind}
        AND browser_binding_hash IS NOT DISTINCT FROM ${input.browserBindingHash}
        AND consumed_at IS NULL
        AND expires_at > ${input.consumedAt}
      RETURNING id, kind, token_hash, browser_binding_hash, payload, expires_at, consumed_at
    `;
    const row = rows[0];
    if (row === undefined) return null;
    const parsed = ChallengeRowSchema.parse(row);
    return {
      id: parsed.id, kind: parsed.kind, tokenHash: parsed.token_hash, browserBindingHash: parsed.browser_binding_hash,
      payload: parsed.payload, expiresAt: parsed.expires_at, consumedAt: parsed.consumed_at,
    };
  }

  async resolveOrCreateUser(input: { readonly provider: "apple" | "magic_link"; readonly subjectHash: string; readonly displayName: string; readonly candidateUserId: UserId; readonly candidateActorId: string }): Promise<AuthUser> {
    return await this.connection.pooled.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.provider}:${input.subjectHash}`}, 0))`;
      const existing = await sql<Record<string, unknown>[]>`
        SELECT u.id, u.actor_id, u.display_name
        FROM external_identities e JOIN users u ON u.id = e.user_id
        WHERE e.provider = ${input.provider} AND e.provider_subject_hash = ${input.subjectHash} AND u.deleted_at IS NULL
      `;
      if (existing[0] !== undefined) return userFromRow(existing[0]);
      const user = { id: UserIdSchema.parse(input.candidateUserId), actorId: ActorIdSchema.parse(input.candidateActorId), displayName: input.displayName };
      await sql`
        INSERT INTO users (id, actor_id, display_name) VALUES (${user.id}, ${user.actorId}, ${user.displayName})
      `;
      await sql`
        INSERT INTO external_identities (provider, provider_subject_hash, user_id)
        VALUES (${input.provider}, ${input.subjectHash}, ${user.id})
      `;
      return user;
    }) as AuthUser;
  }

  async saveSession(session: WebSession): Promise<void> {
    await this.connection.pooled`
      INSERT INTO web_sessions (id, user_id, token_hash, csrf_hash, pending_intent, expires_at, revoked_at)
      VALUES (${session.id}, ${session.userId}, ${session.tokenHash}, ${session.csrfHash}, ${session.pendingIntent === null ? null : this.connection.pooled.json({ path: session.pendingIntent })}, ${session.expiresAt}, ${session.revokedAt})
    `;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<{ readonly session: WebSession; readonly user: AuthUser } | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT s.id, s.user_id, s.token_hash, s.csrf_hash, s.pending_intent->>'path' AS pending_intent,
             s.expires_at, s.revoked_at, u.actor_id, u.display_name
      FROM web_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash} AND u.deleted_at IS NULL
    `;
    const row = rows[0];
    if (row === undefined) return null;
    const parsed = SessionRowSchema.parse(row);
    return {
      session: sessionFromRow(parsed),
      user: { id: parsed.user_id, actorId: ActorIdSchema.parse(parsed.actor_id), displayName: z.string().min(1).parse(parsed.display_name) },
    };
  }

  async revokeSession(tokenHash: string, revokedAt: string): Promise<void> {
    await this.connection.pooled`UPDATE web_sessions SET revoked_at = ${revokedAt} WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
  }

  async revokeUserSessions(userId: UserId, revokedAt: string): Promise<void> {
    await this.connection.pooled`UPDATE web_sessions SET revoked_at = ${revokedAt} WHERE user_id = ${userId} AND revoked_at IS NULL`;
  }
}

function userFromRow(row: Record<string, unknown>): AuthUser {
  const parsed = UserRowSchema.parse(row);
  return { id: parsed.id, actorId: parsed.actor_id, displayName: parsed.display_name };
}

function sessionFromRow(row: z.infer<typeof SessionRowSchema>): WebSession {
  return {
    id: row.id, userId: row.user_id, tokenHash: row.token_hash, csrfHash: row.csrf_hash,
    pendingIntent: row.pending_intent, expiresAt: row.expires_at, revokedAt: row.revoked_at,
  };
}
