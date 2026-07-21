import { RunnerActionAuthorizationRequestSchema, RunnerDeviceIdSchema } from "@hfj/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthenticationPort } from "../core/ports.js";
import { AppError } from "../core/errors.js";
import type { RunnerSnapshotService } from "./snapshot-service.js";

const HouseholdParamsSchema = z.object({ householdId: z.string() }).strict();

export interface RunnerRouteDependencies {
  readonly authentication: AuthenticationPort;
  readonly snapshots: Pick<RunnerSnapshotService, "read" | "authorizeAction">;
}

export async function registerRunnerRoutes(app: FastifyInstance, dependencies: RunnerRouteDependencies): Promise<void> {
  app.get("/api/runner/households/:householdId/snapshot", { config: { rateLimit: { max: 30, timeWindow: 60_000, groupId: "runner-snapshot" } } }, async (request, reply) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    const params = HouseholdParamsSchema.parse(request.params);
    const deviceId = requiredDeviceHeader(request.headers["x-fullwell-runner-device"]);
    const result = await dependencies.snapshots.read(principal, params.householdId, deviceId, headerValue(request.headers["if-none-match"]));
    reply.header("cache-control", "private, no-cache");
    const head = result.kind === "not_modified" ? result.head : result.response.manifest.head;
    reply.header("etag", `"${head}"`);
    return result.kind === "not_modified" ? reply.code(304).send() : reply.send(result.response);
  });

  app.post("/api/runner/households/:householdId/authorize-action", { config: { rateLimit: { max: 60, timeWindow: 60_000, groupId: "runner-action" } } }, async (request) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    const params = HouseholdParamsSchema.parse(request.params);
    const input = RunnerActionAuthorizationRequestSchema.parse(request.body);
    return await dependencies.snapshots.authorizeAction(principal, params.householdId, input.device_id, input.expected_head);
  });
}

function requiredDeviceHeader(value: string | string[] | undefined): string {
  const parsed = RunnerDeviceIdSchema.safeParse(headerValue(value));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "A valid runner device header is required");
  return parsed.data;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
