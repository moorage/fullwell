import Fastify from "fastify";
import { GitObjectIdSchema, HouseholdIdSchema, RunnerDeviceIdSchema } from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { DeterministicTestAuthenticator } from "../adapters/providers.js";
import { registerRunnerRoutes } from "./routes.js";

describe("runner routes", () => {
  it("authenticates snapshot and pre-action requests and preserves ETags", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000701");
    const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000701");
    const head = GitObjectIdSchema.parse("a".repeat(40));
    const snapshots = {
      read: vi.fn(async () => ({ kind: "not_modified" as const, head })),
      authorizeAction: vi.fn(async () => ({ authorized: true as const, head, authorized_at: "2026-07-20T16:00:00.000Z" })),
    };
    const app = Fastify();
    await registerRunnerRoutes(app, { authentication: new DeterministicTestAuthenticator(), snapshots });
    const response = await app.inject({
      method: "GET",
      url: `/api/runner/households/${householdId}/snapshot`,
      headers: { authorization: "Bearer test-owner-token", "x-fullwell-runner-device": deviceId, "if-none-match": `"${head}"` },
    });
    expect(response.statusCode).toBe(304);
    expect(response.headers.etag).toBe(`"${head}"`);
    expect(snapshots.read).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Test Owner" }), householdId, deviceId, `"${head}"`);

    const authorized = await app.inject({
      method: "POST",
      url: `/api/runner/households/${householdId}/authorize-action`,
      headers: { authorization: "Bearer test-owner-token" },
      payload: { device_id: deviceId, expected_head: head },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toMatchObject({ authorized: true, head });
    expect((await app.inject({ method: "GET", url: `/api/runner/households/${householdId}/snapshot` })).statusCode).toBe(500);
    await app.close();
  });
});
