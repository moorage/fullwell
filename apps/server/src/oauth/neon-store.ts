import { OAuthScopeSchema, UserIdSchema } from "@hfj/contracts";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import type { NeonConnection } from "../persistence/neon.js";
import type { OAuthAccessIdentity, OAuthClient, OAuthGrant, OAuthStore, OAuthTokenRecord } from "./types.js";

const TimestampSchema = z.union([z.date(), z.string()]).transform((value) => new Date(value).toISOString());
const NullableTimestampSchema = z.union([z.date(), z.string()]).nullable().transform((value) => value === null ? null : new Date(value).toISOString());
const ClientRowSchema = z.object({
  client_id: z.string(),
  metadata: z.object({ client_name: z.string(), token_endpoint_auth_method: z.literal("none") }),
  redirect_uris: z.array(z.string()),
});
const GrantRowSchema = z.object({
  id: z.string(), user_id: UserIdSchema, client_id: z.string(), scopes: z.array(OAuthScopeSchema),
  resource: z.string(), revoked_at: NullableTimestampSchema,
});
const TokenRowSchema = z.object({
  id: z.string(), grant_id: z.string(), token_kind: z.enum(["authorization_code", "access", "refresh"]),
  token_hash: z.string(), family_id: z.string().nullable(), parent_id: z.string().nullable(),
  pkce_challenge: z.string().nullable(), redirect_uri: z.string().nullable(), audience: z.string(),
  expires_at: TimestampSchema, used_at: NullableTimestampSchema, revoked_at: NullableTimestampSchema,
});
const AccessRowSchema = z.object({
  user_id: UserIdSchema, actor_id: z.string(), display_name: z.string(), client_id: z.string(),
  scopes: z.array(OAuthScopeSchema),
});

export class NeonOAuthStore implements OAuthStore {
  constructor(private readonly connection: NeonConnection) {}

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT client_id, metadata, redirect_uris FROM oauth_clients WHERE client_id = ${clientId}
    `;
    return rows[0] === undefined ? null : clientFromRow(rows[0]);
  }

  async registerClient(client: OAuthClient): Promise<void> {
    await this.connection.pooled`
      INSERT INTO oauth_clients (client_id, metadata, redirect_uris)
      VALUES (${client.clientId}, ${this.connection.pooled.json({ client_name: client.name, token_endpoint_auth_method: client.tokenEndpointAuthMethod })}, ${client.redirectUris})
    `;
  }

  async saveGrant(grant: OAuthGrant): Promise<void> {
    await this.connection.pooled`
      INSERT INTO oauth_grants (id, user_id, client_id, scopes, resource, revoked_at)
      VALUES (${grant.id}, ${grant.userId}, ${grant.clientId}, ${grant.scopes}, ${grant.resource}, ${grant.revokedAt})
    `;
  }

  async getGrant(grantId: string): Promise<OAuthGrant | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, client_id, scopes, resource, revoked_at FROM oauth_grants WHERE id = ${grantId}
    `;
    return rows[0] === undefined ? null : grantFromRow(rows[0]);
  }

  async saveToken(token: OAuthTokenRecord): Promise<void> { await insertToken(this.connection, token); }

  async consumeAuthorizationCode(input: { readonly tokenHash: string; readonly clientId: string; readonly redirectUri: string; readonly pkceChallenge: string; readonly usedAt: string }): Promise<{ readonly token: OAuthTokenRecord; readonly grant: OAuthGrant } | null> {
    return await this.connection.pooled.begin(async (sql) => {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT t.id, t.grant_id, t.token_kind, t.token_hash, t.family_id, t.parent_id, t.pkce_challenge,
               t.redirect_uri, t.audience, t.expires_at, t.used_at, t.revoked_at,
               g.id AS oauth_grant_id, g.user_id, g.client_id, g.scopes, g.resource, g.revoked_at AS grant_revoked_at
        FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
        WHERE t.token_hash = ${input.tokenHash} AND t.token_kind = 'authorization_code'
          AND t.redirect_uri = ${input.redirectUri} AND t.pkce_challenge = ${input.pkceChallenge}
          AND g.client_id = ${input.clientId} AND g.revoked_at IS NULL
          AND t.used_at IS NULL AND t.revoked_at IS NULL AND t.expires_at > ${input.usedAt}
        FOR UPDATE OF t
      `;
      const row = rows[0];
      if (row === undefined) return null;
      const token = tokenFromRow(row);
      const grant = grantFromAliasedRow(row);
      await sql`UPDATE oauth_tokens SET used_at = ${input.usedAt} WHERE id = ${token.id}`;
      return { token, grant };
    }) as { readonly token: OAuthTokenRecord; readonly grant: OAuthGrant } | null;
  }

  async getToken(tokenHash: string): Promise<OAuthTokenRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, grant_id, token_kind, token_hash, family_id, parent_id, pkce_challenge, redirect_uri, audience, expires_at, used_at, revoked_at
      FROM oauth_tokens WHERE token_hash = ${tokenHash}
    `;
    return rows[0] === undefined ? null : tokenFromRow(rows[0]);
  }

  async rotateRefreshToken(input: { readonly tokenHash: string; readonly usedAt: string; readonly access: OAuthTokenRecord; readonly refresh: OAuthTokenRecord }): Promise<"rotated" | "reuse" | "invalid"> {
    return await this.connection.pooled.begin(async (sql) => {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT id, grant_id, token_kind, token_hash, family_id, parent_id, pkce_challenge, redirect_uri, audience, expires_at, used_at, revoked_at
        FROM oauth_tokens WHERE token_hash = ${input.tokenHash} FOR UPDATE
      `;
      const row = rows[0];
      if (row === undefined) return "invalid" as const;
      const current = tokenFromRow(row);
      if (current.usedAt !== null) return "reuse" as const;
      if (current.kind !== "refresh" || current.revokedAt !== null || current.expiresAt <= input.usedAt) return "invalid" as const;
      await sql`UPDATE oauth_tokens SET used_at = ${input.usedAt} WHERE id = ${current.id}`;
      await insertTokenWith(sql, input.access);
      await insertTokenWith(sql, input.refresh);
      return "rotated" as const;
    }) as "rotated" | "reuse" | "invalid";
  }

  async revokeToken(tokenHash: string, revokedAt: string): Promise<void> {
    await this.connection.pooled.begin(async (sql) => {
      const rows = await sql<{ family_id: string | null }[]>`SELECT family_id FROM oauth_tokens WHERE token_hash = ${tokenHash} FOR UPDATE`;
      const familyId = rows[0]?.family_id;
      if (familyId === undefined) return;
      if (familyId === null) await sql`UPDATE oauth_tokens SET revoked_at = ${revokedAt} WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
      else await sql`UPDATE oauth_tokens SET revoked_at = ${revokedAt} WHERE family_id = ${familyId} AND revoked_at IS NULL`;
    });
  }

  async revokeFamily(familyId: string, revokedAt: string): Promise<void> {
    await this.connection.pooled`UPDATE oauth_tokens SET revoked_at = ${revokedAt} WHERE family_id = ${familyId} AND revoked_at IS NULL`;
  }

  async resolveAccessToken(tokenHash: string, now: string): Promise<OAuthAccessIdentity | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT g.user_id, u.actor_id, u.display_name, g.client_id, g.scopes
      FROM oauth_tokens t
      JOIN oauth_grants g ON g.id = t.grant_id
      JOIN users u ON u.id = g.user_id
      WHERE t.token_hash = ${tokenHash} AND t.token_kind = 'access'
        AND t.revoked_at IS NULL AND t.expires_at > ${now}
        AND g.revoked_at IS NULL AND g.resource = t.audience AND u.deleted_at IS NULL
    `;
    if (rows[0] === undefined) return null;
    const parsed = AccessRowSchema.parse(rows[0]);
    return { userId: parsed.user_id, actorId: parsed.actor_id, displayName: parsed.display_name, clientId: parsed.client_id, scopes: parsed.scopes };
  }
}

async function insertToken(connection: NeonConnection, token: OAuthTokenRecord): Promise<void> { await insertTokenWith(connection.pooled, token); }

async function insertTokenWith(sql: Sql | TransactionSql, token: OAuthTokenRecord): Promise<void> {
  await sql`
    INSERT INTO oauth_tokens (id, grant_id, token_kind, token_hash, family_id, parent_id, pkce_challenge, redirect_uri, audience, expires_at, used_at, revoked_at)
    VALUES (${token.id}, ${token.grantId}, ${token.kind}, ${token.tokenHash}, ${token.familyId}, ${token.parentId}, ${token.pkceChallenge}, ${token.redirectUri}, ${token.audience}, ${token.expiresAt}, ${token.usedAt}, ${token.revokedAt})
  `;
}

function clientFromRow(row: Record<string, unknown>): OAuthClient {
  const parsed = ClientRowSchema.parse(row);
  return { clientId: parsed.client_id, name: parsed.metadata.client_name, redirectUris: parsed.redirect_uris, tokenEndpointAuthMethod: parsed.metadata.token_endpoint_auth_method };
}

function grantFromRow(row: Record<string, unknown>): OAuthGrant {
  const parsed = GrantRowSchema.parse(row);
  return { id: parsed.id, userId: parsed.user_id, clientId: parsed.client_id, scopes: parsed.scopes, resource: parsed.resource, revokedAt: parsed.revoked_at };
}

function grantFromAliasedRow(row: Record<string, unknown>): OAuthGrant {
  return grantFromRow({ ...row, id: row.oauth_grant_id, revoked_at: row.grant_revoked_at });
}

function tokenFromRow(row: Record<string, unknown>): OAuthTokenRecord {
  const parsed = TokenRowSchema.parse(row);
  return {
    id: parsed.id, grantId: parsed.grant_id, kind: parsed.token_kind, tokenHash: parsed.token_hash,
    familyId: parsed.family_id, parentId: parsed.parent_id, pkceChallenge: parsed.pkce_challenge,
    redirectUri: parsed.redirect_uri, audience: parsed.audience, expiresAt: parsed.expires_at,
    usedAt: parsed.used_at, revokedAt: parsed.revoked_at,
  };
}
