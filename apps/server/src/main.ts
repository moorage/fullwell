import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MemoryOperationalStore } from "./adapters/memory.js";
import {
  CryptoRandomSource,
  DeterministicTestAuthenticator,
  AppleIdentityProvider,
  HmacTokenHasher,
  ResendMailProvider,
  SystemClock,
  UnconfiguredAppleIdentityProvider,
  UnconfiguredMailProvider,
} from "./adapters/providers.js";
import { MemoryAuthStore } from "./auth/memory-store.js";
import { NeonAuthStore } from "./auth/neon-store.js";
import { WebAuthnPasskeyProvider } from "./auth/providers.js";
import { browserCsrfVerifier, browserPrincipalResolver } from "./auth/routes.js";
import { BrowserAuthService } from "./auth/service.js";
import { AccountService } from "./account/service.js";
import type { AuthStore } from "./auth/types.js";
import { parseConfig } from "./config.js";
import type { AuthenticationPort, OperationalStorePort, SessionStorePort } from "./core/ports.js";
import { GitHouseholdRepository } from "./git/git-repository.js";
import { buildApp } from "./http/app.js";
import { WebViewModelService } from "./http/web-view-model.js";
import { MemoryOAuthStore } from "./oauth/memory-store.js";
import { NeonOAuthStore } from "./oauth/neon-store.js";
import { OAuthBearerAuthenticator } from "./oauth/authenticator.js";
import { OAuthService } from "./oauth/service.js";
import type { OAuthStore } from "./oauth/types.js";
import { NeonOperationalStore } from "./persistence/neon-operational-store.js";
import { NeonConnection } from "./persistence/neon.js";
import { HouseholdFoodJournalService } from "./services/household-food-journal.js";
import { FileExportArtifactStore } from "./exports/artifact-store.js";
import { createOperatorAuthenticator, HealthService } from "./health/health.js";
import { ServiceObservability } from "./telemetry/observability.js";
import { BackupCryptography } from "./backup/backup-cryptography.js";

const config = parseConfig(process.env);
const repositoryRoot = resolve(import.meta.dirname, "../../..");
await Promise.all([mkdir(resolve(config.HOUSEHOLD_REPOSITORY_ROOT), { recursive: true }), mkdir(resolve(config.HOUSEHOLD_WORKTREE_ROOT), { recursive: true })]);
const hasher = new HmacTokenHasher(config.TOKEN_PEPPER ?? "local-development-pepper-change-me-000000");
const connection = config.DATABASE_URL === undefined || config.DATABASE_DIRECT_URL === undefined
  ? null
  : new NeonConnection(config.DATABASE_URL, config.DATABASE_DIRECT_URL);
const store: OperationalStorePort & SessionStorePort = connection === null
  ? new MemoryOperationalStore()
  : new NeonOperationalStore(connection, hasher);
const authStore: AuthStore = connection === null ? new MemoryAuthStore() : new NeonAuthStore(connection);
const oauthStore: OAuthStore = connection === null ? new MemoryOAuthStore() : new NeonOAuthStore(connection);
const repository = new GitHouseholdRepository({
  repositoryRoot: config.HOUSEHOLD_REPOSITORY_ROOT,
  worktreeRoot: config.HOUSEHOLD_WORKTREE_ROOT,
  ...(config.GIT_SIGNING_KEY === undefined ? {} : { signingKey: config.GIT_SIGNING_KEY }),
  ...(config.GIT_ALLOWED_SIGNERS_FILE === undefined ? {} : { allowedSignersFile: config.GIT_ALLOWED_SIGNERS_FILE }),
  requireSigning: config.NODE_ENV === "production",
});
const clock = new SystemClock();
const random = new CryptoRandomSource();
const telemetry = new ServiceObservability();
const publicOrigin = new URL(config.PUBLIC_ORIGIN);
const mail = config.MAIL_PROVIDER_API_KEY === undefined || config.MAIL_FROM === undefined
  ? new UnconfiguredMailProvider()
  : new ResendMailProvider(config.MAIL_PROVIDER_API_KEY, config.MAIL_FROM);
const identity = config.APPLE_CLIENT_ID === undefined || config.APPLE_TEAM_ID === undefined || config.APPLE_KEY_ID === undefined || config.APPLE_PRIVATE_KEY === undefined
  ? new UnconfiguredAppleIdentityProvider()
  : new AppleIdentityProvider(config.APPLE_CLIENT_ID, config.APPLE_TEAM_ID, config.APPLE_KEY_ID, config.APPLE_PRIVATE_KEY);
const exportArtifacts = new FileExportArtifactStore(config.EXPORT_ROOT);
const service = new HouseholdFoodJournalService(store, repository, clock, random, hasher, telemetry, publicOrigin, exportArtifacts);
const passkeys = new WebAuthnPasskeyProvider({ rpName: "Fullwell", rpId: publicOrigin.hostname, origin: publicOrigin.origin });
const browserAuth = new BrowserAuthService(authStore, clock, random, hasher, mail, identity, passkeys, publicOrigin);
const oauth = new OAuthService(oauthStore, clock, random, hasher, new URL("/mcp", publicOrigin));
const accounts = new AccountService(authStore, store, oauthStore, clock, repository, random);
const backupCryptography = config.BACKUP_ENCRYPTION_KEY === undefined || config.BACKUP_MANIFEST_PRIVATE_KEY === undefined || config.BACKUP_MANIFEST_PUBLIC_KEY === undefined || config.BACKUP_KEY_ID === undefined
  ? null
  : new BackupCryptography(config.BACKUP_ENCRYPTION_KEY, config.BACKUP_MANIFEST_PRIVATE_KEY, config.BACKUP_MANIFEST_PUBLIC_KEY, config.BACKUP_KEY_ID);
const health = new HealthService(store, repository, {
  clock,
  expectedSchemaVersion: "0005",
  repositoryRoot: config.HOUSEHOLD_REPOSITORY_ROOT,
  signingConfigured: config.GIT_SIGNING_KEY !== undefined && config.GIT_ALLOWED_SIGNERS_FILE !== undefined && backupCryptography !== null,
});
const productionAuthentication = new OAuthBearerAuthenticator(oauth, async (clientId) => {
  const client = await oauthStore.getClient(clientId);
  return client?.name.toLocaleLowerCase("en-US").includes("claude") === true ? "claude" : "codex";
});
const authentication: AuthenticationPort = config.AUTH_MODE === "test"
  ? new DeterministicTestAuthenticator()
  : productionAuthentication;
const webViewModels = await WebViewModelService.create({
  service,
  store,
  authentication,
  hasher,
  random,
  publicOrigin,
  installMetadataPath: resolve(repositoryRoot, "packages/agent-client/install-metadata.json"),
  resolvePrincipal: async (request) => request.cookies.hfj_session === undefined ? null : browserAuth.authenticateSession(request.cookies.hfj_session),
  verifyCsrf: browserCsrfVerifier(browserAuth),
  listPasskeys: (userId) => browserAuth.listPasskeys(userId),
  accountSummary: (userId) => accounts.summary(userId),
});
const app = await buildApp({
  service,
  authentication,
  store,
  repository,
  mail,
  identity,
  random,
  publicOrigin,
  health,
  observability: telemetry,
  ...(config.OPERATOR_TOKEN === undefined ? {} : { operatorAuthentication: createOperatorAuthenticator(config.OPERATOR_TOKEN, hasher) }),
  browserAuth: {
    auth: browserAuth,
    secureCookies: config.NODE_ENV === "production",
    ...(config.APPLE_CLIENT_ID === undefined ? {} : { appleAuthorization: { clientId: config.APPLE_CLIENT_ID, redirectUri: new URL("/auth/apple/callback", publicOrigin).toString() } }),
  },
  account: { auth: browserAuth, accounts, journal: service },
  oauth: { oauth, resolveBrowserPrincipal: browserPrincipalResolver(browserAuth), verifyCsrf: browserCsrfVerifier(browserAuth) },
  exportDownloads: {
    artifacts: exportArtifacts,
    hasher,
    clock,
    resolveBrowserPrincipal: async (request) => request.cookies.hfj_session === undefined ? null : browserAuth.authenticateSession(request.cookies.hfj_session),
  },
  web: {
    assetsRoot: resolve(repositoryRoot, "apps/web/dist"),
    contextFor: (request) => webViewModels.contextFor(request),
    createHousehold: (request, input) => webViewModels.createHousehold(request, input),
    importCollection: (request, input) => webViewModels.importCollection(request, input),
  },
});
await app.listen({ host: config.HOST, port: config.PORT });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    // Node signal listeners cannot be awaited; this chain owns shutdown failures and exits only after resources close.
    void app.close().then(async () => {
      if (connection !== null) await connection.close();
      process.exit(0);
    }).catch((error: unknown) => {
      process.stderr.write(`${JSON.stringify({ level: "error", event: "shutdown.failed", error: error instanceof Error ? error.name : "NonErrorFailure" })}\n`);
      process.exit(1);
    });
  });
}
