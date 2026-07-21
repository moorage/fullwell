import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("requires production secrets and separate Neon URLs", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/forbidden/);
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_MODE: "session" })).toThrow(/incomplete/);
    expect(() => parseConfig({ NODE_ENV: "test", DATABASE_URL: "postgres://localhost/db" })).toThrow(/configured together/);
  });

  it("provides deterministic local defaults", () => {
    expect(parseConfig({ NODE_ENV: "test", PATH: "/usr/bin", HOME: "/tmp" })).toMatchObject({ PORT: 3000, AUTH_MODE: "test", EXPORT_ROOT: "./.data/exports", BACKUP_RETENTION_DAYS: 35 });
    expect(() => parseConfig({ NODE_ENV: "test", OBJECT_STORAGE_BUCKET: "backup" })).toThrow(/must be complete/);
  });

  it("loads secrets from systemd credential files", () => {
    const directory = mkdtempSync(join(tmpdir(), "hfj-config-"));
    try {
      const pepper = join(directory, "pepper");
      writeFileSync(pepper, "a-secure-pepper-value-that-is-long-enough\n", { mode: 0o600 });
      expect(parseConfig({ NODE_ENV: "test", TOKEN_PEPPER_FILE: pepper }).TOKEN_PEPPER).toBe("a-secure-pepper-value-that-is-long-enough");
      expect(parseConfig({ NODE_ENV: "test", GIT_SIGNING_KEY_FILE: pepper }).GIT_SIGNING_KEY).toBe(pepper);
      expect(() => parseConfig({ NODE_ENV: "test", TOKEN_PEPPER: "inline-value-that-is-long-enough-000", TOKEN_PEPPER_FILE: pepper })).toThrow(/mutually exclusive/);
      expect(() => parseConfig({ NODE_ENV: "test", GIT_SIGNING_KEY: "inline", GIT_SIGNING_KEY_FILE: pepper })).toThrow(/mutually exclusive/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("requires complete HTTPS object backup configuration in production", () => {
    const production = {
      NODE_ENV: "production",
      AUTH_MODE: "session",
      PUBLIC_ORIGIN: "https://journal.example.test",
      DATABASE_URL: "postgresql://runtime.example.test/fullwell",
      DATABASE_DIRECT_URL: "postgresql://direct.example.test/fullwell",
      GIT_SIGNING_KEY: "signing-key",
      GIT_ALLOWED_SIGNERS_FILE: "/run/secrets/git-allowed-signers",
      TOKEN_PEPPER: "p".repeat(32),
      SESSION_SECRET: "s".repeat(32),
      OPERATOR_TOKEN: "o".repeat(32),
      APPLE_CLIENT_ID: "apple-client",
      APPLE_TEAM_ID: "apple-team",
      APPLE_KEY_ID: "apple-key",
      APPLE_PRIVATE_KEY: "apple-private",
      MAIL_PROVIDER_API_KEY: "mail-key",
      MAIL_FROM: "Fullwell <mail@example.test>",
      OBJECT_STORAGE_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
      OBJECT_STORAGE_REGION: "us-west-004",
      OBJECT_STORAGE_BUCKET: "fullwell-backup",
      OBJECT_STORAGE_ACCESS_KEY_ID: "storage-key-id",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "storage-secret",
      BACKUP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64url"),
      BACKUP_MANIFEST_PRIVATE_KEY: "manifest-private",
      BACKUP_MANIFEST_PUBLIC_KEY: "manifest-public",
      BACKUP_KEY_ID: "backup-2026-01",
    };
    expect(parseConfig(production)).toMatchObject({ OBJECT_STORAGE_REGION: "us-west-004", BACKUP_RETENTION_DAYS: 35 });
    expect(() => parseConfig({ ...production, OBJECT_STORAGE_ENDPOINT: "http://storage.example.test" })).toThrow(/HTTPS/);
  });

  it("requires complete service-only WhatsApp configuration and a non-billable cutoff", () => {
    expect(() => parseConfig({ NODE_ENV: "test", WHATSAPP_WEBHOOK_ENABLED: "true" })).toThrow(/WHATSAPP_ENABLED/);
    expect(() => parseConfig({ NODE_ENV: "test", WHATSAPP_ENABLED: "true" })).toThrow(/incomplete/);
    const configured = {
      NODE_ENV: "test",
      WHATSAPP_ENABLED: "true",
      WHATSAPP_WEBHOOK_ENABLED: "true",
      WHATSAPP_LINKING_ENABLED: "true",
      WHATSAPP_RUNNER_CLAIMS_ENABLED: "true",
      WHATSAPP_SERVICE_REPLIES_ENABLED: "true",
      WHATSAPP_MODE: "service_only",
      WHATSAPP_GRAPH_API_VERSION: "v24.0",
      WHATSAPP_BUSINESS_ACCOUNT_ID: "123456789012345",
      WHATSAPP_PHONE_NUMBER_ID: "123456789012346",
      WHATSAPP_CONTACT_URL: "https://wa.me/15555550100",
      WHATSAPP_APP_SECRET: "a".repeat(32),
      WHATSAPP_ACCESS_TOKEN: "t".repeat(64),
      WHATSAPP_VERIFY_TOKEN: "v".repeat(32),
      MESSAGE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64url"),
    };
    expect(parseConfig(configured)).toMatchObject({ WHATSAPP_ENABLED: true, WHATSAPP_MODE: "service_only" });
    expect(() => parseConfig({ ...configured, WHATSAPP_FREE_SERVICE_SEND_CUTOFF: "2026-10-01T00:00:01-07:00" })).toThrow(/cannot move past/);
  });
});
