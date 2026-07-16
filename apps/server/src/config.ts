import { z } from "zod";
import { readFileSync } from "node:fs";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PUBLIC_ORIGIN: z.url().default("http://127.0.0.1:3000"),
  AUTH_MODE: z.enum(["test", "session"]).default("test"),
  DATABASE_URL: z.url().optional(),
  DATABASE_DIRECT_URL: z.url().optional(),
  HOUSEHOLD_REPOSITORY_ROOT: z.string().min(1).default("./.data/households"),
  HOUSEHOLD_WORKTREE_ROOT: z.string().min(1).default("./.data/worktrees"),
  EXPORT_ROOT: z.string().min(1).default("./.data/exports"),
  OBJECT_STORAGE_ENDPOINT: z.url().optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(3).optional(),
  OBJECT_STORAGE_PREFIX: z.string().min(1).default("household-food-journal/v1"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  BACKUP_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  BACKUP_MANIFEST_PRIVATE_KEY: z.string().min(1).optional(),
  BACKUP_MANIFEST_PUBLIC_KEY: z.string().min(1).optional(),
  BACKUP_KEY_ID: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/).optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(3_000).default(35),
  GIT_SIGNING_KEY: z.string().min(1).optional(),
  GIT_ALLOWED_SIGNERS_FILE: z.string().min(1).optional(),
  TOKEN_PEPPER: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  OPERATOR_TOKEN: z.string().min(32).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),
  MAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).optional(),
});

export type AppConfig = Readonly<z.infer<typeof ConfigSchema>>;

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const config = ConfigSchema.parse({
    NODE_ENV: env.NODE_ENV,
    HOST: env.HOST,
    PORT: env.PORT,
    PUBLIC_ORIGIN: env.PUBLIC_ORIGIN,
    AUTH_MODE: env.AUTH_MODE,
    HOUSEHOLD_REPOSITORY_ROOT: env.HOUSEHOLD_REPOSITORY_ROOT,
    HOUSEHOLD_WORKTREE_ROOT: env.HOUSEHOLD_WORKTREE_ROOT,
    EXPORT_ROOT: env.EXPORT_ROOT,
    OBJECT_STORAGE_ENDPOINT: env.OBJECT_STORAGE_ENDPOINT,
    OBJECT_STORAGE_REGION: env.OBJECT_STORAGE_REGION,
    OBJECT_STORAGE_BUCKET: env.OBJECT_STORAGE_BUCKET,
    OBJECT_STORAGE_PREFIX: env.OBJECT_STORAGE_PREFIX,
    OBJECT_STORAGE_ACCESS_KEY_ID: secret(env, "OBJECT_STORAGE_ACCESS_KEY_ID"),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: secret(env, "OBJECT_STORAGE_SECRET_ACCESS_KEY"),
    BACKUP_ENCRYPTION_KEY: secret(env, "BACKUP_ENCRYPTION_KEY"),
    BACKUP_MANIFEST_PRIVATE_KEY: secret(env, "BACKUP_MANIFEST_PRIVATE_KEY"),
    BACKUP_MANIFEST_PUBLIC_KEY: secret(env, "BACKUP_MANIFEST_PUBLIC_KEY"),
    BACKUP_KEY_ID: env.BACKUP_KEY_ID,
    BACKUP_RETENTION_DAYS: env.BACKUP_RETENTION_DAYS,
    DATABASE_URL: secret(env, "DATABASE_URL"),
    DATABASE_DIRECT_URL: secret(env, "DATABASE_DIRECT_URL"),
    GIT_SIGNING_KEY: secretReference(env, "GIT_SIGNING_KEY"),
    GIT_ALLOWED_SIGNERS_FILE: env.GIT_ALLOWED_SIGNERS_FILE,
    TOKEN_PEPPER: secret(env, "TOKEN_PEPPER"),
    SESSION_SECRET: secret(env, "SESSION_SECRET"),
    OPERATOR_TOKEN: secret(env, "OPERATOR_TOKEN"),
    APPLE_CLIENT_ID: env.APPLE_CLIENT_ID,
    APPLE_TEAM_ID: env.APPLE_TEAM_ID,
    APPLE_KEY_ID: env.APPLE_KEY_ID,
    APPLE_PRIVATE_KEY: secret(env, "APPLE_PRIVATE_KEY"),
    MAIL_PROVIDER_API_KEY: secret(env, "MAIL_PROVIDER_API_KEY"),
    MAIL_FROM: env.MAIL_FROM,
  });
  if (config.NODE_ENV === "production") {
    if (config.AUTH_MODE === "test") throw new Error("AUTH_MODE=test is forbidden in production");
    const required = [
      "DATABASE_URL", "DATABASE_DIRECT_URL", "GIT_SIGNING_KEY", "GIT_ALLOWED_SIGNERS_FILE", "TOKEN_PEPPER", "SESSION_SECRET", "OPERATOR_TOKEN",
      "APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "MAIL_PROVIDER_API_KEY", "MAIL_FROM",
      "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY",
      "BACKUP_ENCRYPTION_KEY", "BACKUP_MANIFEST_PRIVATE_KEY", "BACKUP_MANIFEST_PUBLIC_KEY", "BACKUP_KEY_ID",
    ] as const;
    const missing = required.filter((key) => config[key] === undefined);
    if (missing.length > 0) {
      throw new Error(`Production configuration is incomplete: ${[...new Set(missing)].join(", ")}`);
    }
  }
  if ((config.DATABASE_URL === undefined) !== (config.DATABASE_DIRECT_URL === undefined)) {
    throw new Error("DATABASE_URL and DATABASE_DIRECT_URL must be configured together");
  }
  const backupKeys = [
    "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "BACKUP_ENCRYPTION_KEY", "BACKUP_MANIFEST_PRIVATE_KEY", "BACKUP_MANIFEST_PUBLIC_KEY", "BACKUP_KEY_ID",
  ] as const;
  const configuredBackupKeys = backupKeys.filter((key) => config[key] !== undefined);
  if (configuredBackupKeys.length !== 0 && configuredBackupKeys.length !== backupKeys.length) throw new Error("Object backup configuration must be complete");
  if (config.NODE_ENV === "production" && config.OBJECT_STORAGE_ENDPOINT !== undefined && new URL(config.OBJECT_STORAGE_ENDPOINT).protocol !== "https:") {
    throw new Error("Production object storage must use HTTPS");
  }
  return config;
}

function secret(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const inline = env[name];
  const file = env[`${name}_FILE`];
  if (inline !== undefined && file !== undefined) throw new Error(`${name} and ${name}_FILE are mutually exclusive`);
  if (file === undefined) return inline;
  try {
    return readFileSync(file, "utf8").replace(/[\r\n]+$/, "");
  } catch (error) {
    throw new Error(`Unable to read ${name}_FILE`, { cause: error });
  }
}

function secretReference(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const inline = env[name];
  const file = env[`${name}_FILE`];
  if (inline !== undefined && file !== undefined) throw new Error(`${name} and ${name}_FILE are mutually exclusive`);
  return file ?? inline;
}
