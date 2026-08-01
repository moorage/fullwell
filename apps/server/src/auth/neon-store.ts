import { ActorIdSchema, UserIdSchema, type UserId } from "@hfj/contracts";
import { z } from "zod";
import type { NeonConnection } from "../persistence/neon.js";
import type { AuthChallenge, AuthStore, AuthUser, ExternalIdentityProvider, IdentityLinkResult, IdentityMethodProvider, MethodRemovalResult, PasskeyCredential, WebSession } from "./types.js";

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
const PasskeyRowSchema = z.object({
  credential_id: z.string().min(1),
  user_id: UserIdSchema,
  public_key: z.instanceof(Uint8Array),
  counter: z.union([z.number(), z.string(), z.bigint()]).transform((value) => z.number().int().nonnegative().parse(Number(value))),
  transports: z.array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"])),
  device_type: z.enum(["singleDevice", "multiDevice"]),
  backed_up: z.boolean(),
  display_name: z.string().min(1).max(120),
  created_at: TimestampSchema,
  last_used_at: NullableTimestampSchema,
});
const SessionRowSchema = z.object({
  id: z.string(), user_id: UserIdSchema, token_hash: z.string(), csrf_hash: z.string(),
  pending_intent: z.string().nullable(), authenticated_at: TimestampSchema, expires_at: TimestampSchema, revoked_at: NullableTimestampSchema,
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

  async resolveOrCreateUser(input: { readonly provider: ExternalIdentityProvider; readonly subjectHash: string; readonly displayName: string; readonly candidateUserId: UserId; readonly candidateActorId: string }): Promise<AuthUser> {
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

  async getUserById(userId: UserId): Promise<AuthUser | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, actor_id, display_name FROM users WHERE id = ${userId} AND deleted_at IS NULL
    `;
    return rows[0] === undefined ? null : userFromRow(rows[0]);
  }

  async updateUserDisplayName(userId: UserId, displayName: string, updatedAt: string): Promise<AuthUser | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE users SET display_name = ${displayName}, updated_at = ${updatedAt}
      WHERE id = ${userId} AND deleted_at IS NULL
      RETURNING id, actor_id, display_name
    `;
    return rows[0] === undefined ? null : userFromRow(rows[0]);
  }

  async listIdentityMethods(userId: UserId): Promise<readonly IdentityMethodProvider[]> {
    const rows = await this.connection.pooled<{ provider: IdentityMethodProvider }[]>`
      SELECT DISTINCT provider FROM external_identities
      WHERE user_id = ${userId} AND provider IN ('apple', 'magic_link')
      ORDER BY provider
    `;
    return rows.map(({ provider }) => z.enum(["apple", "magic_link"]).parse(provider));
  }

  async linkIdentityMethod(userId: UserId, provider: IdentityMethodProvider, subjectHash: string): Promise<IdentityLinkResult> {
    return await this.connection.pooled.begin(async (sql) => {
      const users = await sql`SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE`;
      if (users.length === 0) return "user_not_found" as const;
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${provider}:${subjectHash}`}, 0))`;
      const identities = await sql<{ user_id: UserId }[]>`
        SELECT user_id FROM external_identities
        WHERE provider = ${provider} AND provider_subject_hash = ${subjectHash}
      `;
      const existing = identities[0];
      if (existing?.user_id === userId) return "already_linked" as const;
      if (existing !== undefined) return "identity_in_use" as const;
      await sql`
        INSERT INTO external_identities (provider, provider_subject_hash, user_id)
        VALUES (${provider}, ${subjectHash}, ${userId})
      `;
      return "linked" as const;
    }) as IdentityLinkResult;
  }

  async removeIdentityMethod(userId: UserId, provider: IdentityMethodProvider): Promise<MethodRemovalResult> {
    return await this.connection.pooled.begin(async (sql) => {
      await sql`SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE`;
      const existing = await sql`SELECT 1 FROM external_identities WHERE user_id = ${userId} AND provider = ${provider} LIMIT 1`;
      if (existing.length === 0) return "not_found" as const;
      if (await signInMethodCount(sql, userId) <= 1) return "last_method" as const;
      await sql`DELETE FROM external_identities WHERE user_id = ${userId} AND provider = ${provider}`;
      return "removed" as const;
    }) as MethodRemovalResult;
  }

  async deleteUser(userId: UserId, formerMemberName: string, deletedAt: string): Promise<boolean> {
    return await this.connection.pooled.begin(async (sql) => {
      const rows = await sql<Record<string, unknown>[]>`
        UPDATE users SET display_name = ${formerMemberName}, email_ciphertext = NULL, deleted_at = ${deletedAt}, updated_at = ${deletedAt}
        WHERE id = ${userId} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) return false;
      await sql`UPDATE web_sessions SET revoked_at = ${deletedAt} WHERE user_id = ${userId} AND revoked_at IS NULL`;
      await sql`UPDATE passkey_credentials SET revoked_at = ${deletedAt} WHERE user_id = ${userId} AND revoked_at IS NULL`;
      await sql`DELETE FROM external_identities WHERE user_id = ${userId}`;
      return true;
    }) as boolean;
  }

  async savePasskeyCredential(credential: PasskeyCredential): Promise<boolean> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      INSERT INTO passkey_credentials (
        credential_id, user_id, public_key, counter, transports, device_type, backed_up, display_name, created_at, last_used_at
      ) VALUES (
        ${credential.credentialId}, ${credential.userId}, ${credential.publicKey}, ${credential.counter}, ${[...credential.transports]},
        ${credential.deviceType}, ${credential.backedUp}, ${credential.name}, ${credential.createdAt}, ${credential.lastUsedAt}
      )
      ON CONFLICT (credential_id) DO NOTHING
      RETURNING credential_id
    `;
    return rows[0] !== undefined;
  }

  async getPasskeyCredential(credentialId: string): Promise<PasskeyCredential | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT credential_id, user_id, public_key, counter, transports, device_type, backed_up,
             display_name, created_at, last_used_at
      FROM passkey_credentials
      WHERE credential_id = ${credentialId} AND revoked_at IS NULL
    `;
    return rows[0] === undefined ? null : passkeyFromRow(rows[0]);
  }

  async listPasskeyCredentials(userId: UserId): Promise<readonly PasskeyCredential[]> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT credential_id, user_id, public_key, counter, transports, device_type, backed_up,
             display_name, created_at, last_used_at
      FROM passkey_credentials
      WHERE user_id = ${userId} AND revoked_at IS NULL
      ORDER BY created_at, credential_id
    `;
    return rows.map(passkeyFromRow);
  }

  async updatePasskeyCounter(input: { readonly credentialId: string; readonly expectedCounter: number; readonly newCounter: number; readonly usedAt: string }): Promise<boolean> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE passkey_credentials
      SET counter = ${input.newCounter}, last_used_at = ${input.usedAt}
      WHERE credential_id = ${input.credentialId}
        AND revoked_at IS NULL
        AND counter = ${input.expectedCounter}
        AND ((${input.newCounter} = 0 AND counter = 0) OR ${input.newCounter} > counter)
      RETURNING credential_id
    `;
    return rows[0] !== undefined;
  }

  async revokePasskeyCredential(input: { readonly credentialId: string; readonly userId: UserId; readonly revokedAt: string }): Promise<MethodRemovalResult> {
    return await this.connection.pooled.begin(async (sql) => {
      await sql`SELECT id FROM users WHERE id = ${input.userId} AND deleted_at IS NULL FOR UPDATE`;
      const existing = await sql`
        SELECT 1 FROM passkey_credentials
        WHERE credential_id = ${input.credentialId} AND user_id = ${input.userId} AND revoked_at IS NULL
      `;
      if (existing.length === 0) return "not_found" as const;
      if (await signInMethodCount(sql, input.userId) <= 1) return "last_method" as const;
      await sql`
        UPDATE passkey_credentials SET revoked_at = ${input.revokedAt}
        WHERE credential_id = ${input.credentialId} AND user_id = ${input.userId} AND revoked_at IS NULL
      `;
      return "removed" as const;
    }) as MethodRemovalResult;
  }

  async saveSession(session: WebSession): Promise<void> {
    await this.connection.pooled`
      INSERT INTO web_sessions (id, user_id, token_hash, csrf_hash, pending_intent, expires_at, revoked_at, created_at)
      VALUES (${session.id}, ${session.userId}, ${session.tokenHash}, ${session.csrfHash}, ${session.pendingIntent === null ? null : this.connection.pooled.json({ path: session.pendingIntent })}, ${session.expiresAt}, ${session.revokedAt}, ${session.authenticatedAt})
    `;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<{ readonly session: WebSession; readonly user: AuthUser } | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT s.id, s.user_id, s.token_hash, s.csrf_hash, s.pending_intent->>'path' AS pending_intent,
             s.created_at AS authenticated_at, s.expires_at, s.revoked_at, u.actor_id, u.display_name
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
    pendingIntent: row.pending_intent, authenticatedAt: row.authenticated_at, expiresAt: row.expires_at, revokedAt: row.revoked_at,
  };
}

async function signInMethodCount(sql: import("postgres").TransactionSql, userId: UserId): Promise<number> {
  const rows = await sql<{ method_count: number | string }[]>`
    SELECT
      (SELECT count(DISTINCT provider) FROM external_identities WHERE user_id = ${userId} AND provider IN ('apple', 'magic_link'))
      + (SELECT count(*) FROM passkey_credentials WHERE user_id = ${userId} AND revoked_at IS NULL) AS method_count
  `;
  return z.coerce.number().int().nonnegative().parse(rows[0]?.method_count);
}

function passkeyFromRow(row: Record<string, unknown>): PasskeyCredential {
  const parsed = PasskeyRowSchema.parse(row);
  return {
    credentialId: parsed.credential_id,
    userId: parsed.user_id,
    publicKey: new Uint8Array(parsed.public_key),
    counter: parsed.counter,
    transports: parsed.transports,
    deviceType: parsed.device_type,
    backedUp: parsed.backed_up,
    name: parsed.display_name,
    createdAt: parsed.created_at,
    lastUsedAt: parsed.last_used_at,
  };
}
