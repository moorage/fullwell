import type { AuthenticationPort, Clock, OperationalStorePort, RandomSource, TelemetryPort, TokenHasher } from "../core/ports.js";
import type { BrowserAuthService } from "../auth/service.js";
import { browserCsrfVerifier } from "../auth/routes.js";
import type { AppConfig } from "../config.js";
import type { NeonConnection } from "../persistence/neon.js";
import type { MessagingRouteDependencies } from "./routes.js";
import { AesGcmMessageCipher } from "./cipher.js";
import { MemoryMessageEnvelopeStore } from "./memory-store.js";
import { NeonMessageEnvelopeStore } from "./neon-store.js";
import { MessagingService } from "./service.js";
import { WhatsAppCloudApiAdapter } from "./whatsapp-cloud-api.js";
import { WhatsAppWebhookBoundary } from "./whatsapp-webhook.js";

export interface MessagingRuntimeDependencies {
  readonly config: AppConfig;
  readonly connection: NeonConnection | null;
  readonly operationalStore: OperationalStorePort;
  readonly authentication: AuthenticationPort;
  readonly browserAuth: BrowserAuthService;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly hasher: TokenHasher;
  readonly telemetry: TelemetryPort;
}

export function createMessagingRuntime(dependencies: MessagingRuntimeDependencies): MessagingRouteDependencies | undefined {
  const { config } = dependencies;
  if (!config.WHATSAPP_ENABLED) return undefined;
  const graphApiVersion = required(config.WHATSAPP_GRAPH_API_VERSION, "WHATSAPP_GRAPH_API_VERSION");
  const businessAccountId = required(config.WHATSAPP_BUSINESS_ACCOUNT_ID, "WHATSAPP_BUSINESS_ACCOUNT_ID");
  const phoneNumberId = required(config.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID");
  const appSecret = required(config.WHATSAPP_APP_SECRET, "WHATSAPP_APP_SECRET");
  const accessToken = required(config.WHATSAPP_ACCESS_TOKEN, "WHATSAPP_ACCESS_TOKEN");
  const verifyToken = required(config.WHATSAPP_VERIFY_TOKEN, "WHATSAPP_VERIFY_TOKEN");
  const encryptionKey = required(config.MESSAGE_ENCRYPTION_KEY, "MESSAGE_ENCRYPTION_KEY");
  const contactUrl = new URL(required(config.WHATSAPP_CONTACT_URL, "WHATSAPP_CONTACT_URL"));
  const messageStore = dependencies.connection === null
    ? new MemoryMessageEnvelopeStore()
    : new NeonMessageEnvelopeStore(dependencies.connection);
  const service = new MessagingService(
    messageStore,
    new AesGcmMessageCipher(encryptionKey),
    new WhatsAppCloudApiAdapter({ graphApiVersion, phoneNumberId, accessToken }),
    {
      isActiveMember: async (userId, householdId) => {
        const membership = await dependencies.operationalStore.getMembership(householdId, userId);
        return membership !== null && membership.removedAt === null;
      },
    },
    dependencies.clock,
    dependencies.random,
    dependencies.hasher,
    dependencies.telemetry,
    {
      freeServiceSendCutoff: new Date(config.WHATSAPP_FREE_SERVICE_SEND_CUTOFF),
      contactUrl,
      intakeEnabled: config.WHATSAPP_WEBHOOK_ENABLED,
      linkingEnabled: config.WHATSAPP_LINKING_ENABLED,
      runnerClaimsEnabled: config.WHATSAPP_RUNNER_CLAIMS_ENABLED,
      serviceRepliesEnabled: config.WHATSAPP_SERVICE_REPLIES_ENABLED,
    },
  );
  return {
    service,
    webhook: new WhatsAppWebhookBoundary({ appSecret, verifyToken, businessAccountId, phoneNumberId }),
    authentication: dependencies.authentication,
    telemetry: dependencies.telemetry,
    requireRecentBrowserAuthentication: async (rawSessionToken) => await dependencies.browserAuth.requireRecentAuthentication(rawSessionToken),
    verifyBrowserCsrf: browserCsrfVerifier(dependencies.browserAuth),
  };
}

function required(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`${name} is required when WhatsApp is enabled`);
  return value;
}
