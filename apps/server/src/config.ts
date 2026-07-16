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
  GIT_SIGNING_KEY: z.string().min(1).optional(),
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
    DATABASE_URL: secret(env, "DATABASE_URL"),
    DATABASE_DIRECT_URL: secret(env, "DATABASE_DIRECT_URL"),
    GIT_SIGNING_KEY: secret(env, "GIT_SIGNING_KEY"),
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
      "DATABASE_URL", "DATABASE_DIRECT_URL", "GIT_SIGNING_KEY", "TOKEN_PEPPER", "SESSION_SECRET", "OPERATOR_TOKEN",
      "APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "MAIL_PROVIDER_API_KEY", "MAIL_FROM",
    ] as const;
    const missing = required.filter((key) => config[key] === undefined);
    if (missing.length > 0) {
      throw new Error(`Production configuration is incomplete: ${[...new Set(missing)].join(", ")}`);
    }
  }
  if ((config.DATABASE_URL === undefined) !== (config.DATABASE_DIRECT_URL === undefined)) {
    throw new Error("DATABASE_URL and DATABASE_DIRECT_URL must be configured together");
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
