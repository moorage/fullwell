import {
  ErrorCodeSchema,
  HouseholdSnapshotResponseSchema,
  RunnerActionAuthorizationResultSchema,
  RunnerClaimResponseSchema,
  RunnerDeviceRegistrationResultSchema,
  RunnerDeviceIdSchema,
  type GitObjectId,
  type HouseholdId,
  type HouseholdSnapshotResponse,
  type MessageEnvelopeId,
  type MessageLeaseId,
  type RunnerClaimResponse,
  type RunnerDeviceId,
} from "@hfj/contracts";
import { z } from "zod";
import type { AccessTokenPort } from "./auth/token-manager.js";
import type { HostTerminal } from "./host/types.js";

const HeartbeatResponseSchema = z.object({ lease_expires_at: z.iso.datetime({ offset: true }) }).strict();
const CompletionResponseSchema = z.object({ state: z.string().min(1).max(64) }).strict();
const GatewayErrorBodySchema = z.object({ error: z.object({ code: ErrorCodeSchema, message: z.string() }).passthrough() }).passthrough();

export class GatewayRequestError extends Error {
  constructor(readonly status: number, readonly code: z.infer<typeof ErrorCodeSchema> | null) {
    super(`Fullwell gateway request failed with status ${status}`);
    this.name = "GatewayRequestError";
  }
}

export interface GatewayPort {
  claim(deviceId: RunnerDeviceId, waitSeconds: number, recoverSaturated?: boolean): Promise<RunnerClaimResponse>;
  heartbeat(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId): Promise<void>;
  complete(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId, terminal: HostTerminal): Promise<void>;
  snapshot(householdId: HouseholdId, deviceId: RunnerDeviceId, currentHead: GitObjectId | null): Promise<HouseholdSnapshotResponse | null>;
  authorizeAction(householdId: HouseholdId, deviceId: RunnerDeviceId, expectedHead: GitObjectId): Promise<void>;
}

export class FullwellGatewayClient implements GatewayPort {
  constructor(
    private readonly origin: URL,
    private readonly tokens: AccessTokenPort,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async registerDevice(householdId: HouseholdId, name: string) {
    return await this.json("/api/runner/devices", RunnerDeviceRegistrationResultSchema, {
      method: "POST",
      body: JSON.stringify({ household_id: householdId, name }),
    });
  }

  async revokeDevice(deviceId: RunnerDeviceId): Promise<void> {
    const response = await this.request(`/api/runner/devices/${deviceId}/revoke`, { method: "POST" });
    if (!response.ok) throw await gatewayFailure(response);
  }

  async claim(deviceId: RunnerDeviceId, waitSeconds: number, recoverSaturated = false): Promise<RunnerClaimResponse> {
    RunnerDeviceIdSchema.parse(deviceId);
    return await this.json("/api/runner/messages/claim", RunnerClaimResponseSchema, {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId, wait_seconds: waitSeconds, recover_saturated: recoverSaturated }),
    });
  }

  async heartbeat(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId): Promise<void> {
    await this.json(`/api/runner/messages/${envelopeId}/heartbeat`, HeartbeatResponseSchema, {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId, lease_id: leaseId }),
    });
  }

  async complete(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId, terminal: HostTerminal): Promise<void> {
    await this.json(`/api/runner/messages/${envelopeId}/complete`, CompletionResponseSchema, {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        lease_id: leaseId,
        terminal: { kind: terminal.kind, message: terminal.message },
        host_session_id: terminal.host_session_id,
      }),
    });
  }

  async snapshot(householdId: HouseholdId, deviceId: RunnerDeviceId, currentHead: GitObjectId | null): Promise<HouseholdSnapshotResponse | null> {
    const response = await this.request(`/api/runner/households/${householdId}/snapshot`, {
      method: "GET",
      headers: {
        "x-fullwell-runner-device": deviceId,
        ...(currentHead === null ? {} : { "if-none-match": `"${currentHead}"` }),
      },
    });
    if (response.status === 304) return null;
    if (!response.ok) throw await gatewayFailure(response);
    return HouseholdSnapshotResponseSchema.parse(await response.json());
  }

  async authorizeAction(householdId: HouseholdId, deviceId: RunnerDeviceId, expectedHead: GitObjectId): Promise<void> {
    await this.json(`/api/runner/households/${householdId}/authorize-action`, RunnerActionAuthorizationResultSchema, {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId, expected_head: expectedHead }),
    });
  }

  private async json<T>(path: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
    const response = await this.request(path, init);
    if (!response.ok) throw await gatewayFailure(response);
    return schema.parse(await response.json());
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let token = await this.tokens.accessToken();
    let response = await this.fetcher(new URL(path, this.origin), withHeaders(init, token));
    if (response.status === 401) {
      this.tokens.invalidate();
      token = await this.tokens.accessToken();
      response = await this.fetcher(new URL(path, this.origin), withHeaders(init, token));
    }
    return response;
  }
}

function withHeaders(init: RequestInit, token: string): RequestInit {
  return {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(35_000),
  };
}

async function gatewayFailure(response: Response): Promise<Error> {
  const body = await response.text();
  if (body === "") return new GatewayRequestError(response.status, null);
  try {
    const parsed = GatewayErrorBodySchema.safeParse(JSON.parse(body));
    return new GatewayRequestError(response.status, parsed.success ? parsed.data.error.code : null);
  } catch (error) {
    if (error instanceof SyntaxError) return new GatewayRequestError(response.status, null);
    throw error;
  }
}
