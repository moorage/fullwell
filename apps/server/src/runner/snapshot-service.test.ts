import { unzipSync, strFromU8 } from "fflate";
import {
  ActorIdSchema,
  HouseholdIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { MemoryHouseholdRepository } from "../adapters/memory.js";
import { FixedClock } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { RunnerSnapshotService, type RunnerSnapshotAuthorizationPort } from "./snapshot-service.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000601");
const actorId = ActorIdSchema.parse("act_0000000000000601");
const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000601");
const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000601"),
  actorId,
  displayName: "Snapshot Runner",
  scopes: new Set(["journal:read", "runner:messages"]),
  client: "codex",
};

async function fixture() {
  const repository = new MemoryHouseholdRepository();
  const initialHead = await repository.provision(householdId, "Private Household Name", actorId, "2026-07-20T16:00:00.000Z");
  const head = await repository.commit(householdId, initialHead, [
    { path: "profiles/snacks.md", content: "# Snack profile\n", appendOnly: false },
    { path: "snacks/items/cashews.md", content: "# Salted cashews\n", appendOnly: false },
    { path: "snacks/evidence/2026/order-one.json", content: "{\"store\":\"fixture\"}\n", appendOnly: true },
    { path: "snacks/reports/recurring-snacks.md", content: "# Recurring\n", appendOnly: false },
    { path: "recipes/private.md", content: "# Must stay server-side\n", appendOnly: false },
  ], {
    requestId: RequestIdSchema.parse("req_0000000000000601"),
    householdId,
    actorId,
    tool: "hfj_update_profile",
    client: "test",
    summary: "fixture",
    occurredAt: "2026-07-20T16:01:00.000Z",
  });
  const authorize = vi.fn(async () => undefined);
  const authorization: RunnerSnapshotAuthorizationPort = {
    withHouseholdLock: async (_householdId, operation) => await operation(),
    authorize,
  };
  const service = new RunnerSnapshotService(repository, authorization, new FixedClock(new Date("2026-07-20T16:02:00.000Z")));
  return { repository, service, authorize, head };
}

describe("RunnerSnapshotService", () => {
  it("returns only allowlisted restocking files with a deterministic manifest", async () => {
    const { service, authorize, head } = await fixture();
    const result = await service.read(principal, householdId, deviceId, undefined);
    expect(result.kind).toBe("snapshot");
    if (result.kind !== "snapshot") throw new Error("Expected a snapshot");
    expect(result.response.manifest).toMatchObject({ household_id: householdId, head, created_at: "2026-07-20T16:02:00.000Z" });
    expect(result.response.manifest.files.map((file) => file.path)).toEqual([
      "FORMAT_VERSION",
      "profiles/snacks.md",
      "snacks/evidence/2026/order-one.json",
      "snacks/items/cashews.md",
      "snacks/reports/recurring-snacks.md",
    ]);
    expect(result.response.manifest.files.every((file) => file.mode === 0o600 && file.sha256.length === 64)).toBe(true);
    const archive = unzipSync(Buffer.from(result.response.archive_base64, "base64"));
    expect(Object.keys(archive).sort()).toEqual(result.response.manifest.files.map((file) => file.path));
    expect(strFromU8(archive["snacks/items/cashews.md"] ?? new Uint8Array())).toBe("# Salted cashews\n");
    expect(result.response.archive_base64).not.toContain("Private Household Name");
    expect(authorize).toHaveBeenCalledWith(principal, deviceId, householdId);
  });

  it("returns not-modified and rejects a stale pre-action head", async () => {
    const { service, head } = await fixture();
    await expect(service.read(principal, householdId, deviceId, `W/"old", "${head}"`)).resolves.toEqual({ kind: "not_modified", head });
    await expect(service.authorizeAction(principal, householdId, deviceId, head)).resolves.toMatchObject({ authorized: true, head });
    await expect(service.authorizeAction(principal, householdId, deviceId, "a".repeat(40))).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("propagates authorization failures before reading Git", async () => {
    const { repository } = await fixture();
    const service = new RunnerSnapshotService(repository, {
      withHouseholdLock: async (_householdId, operation) => await operation(),
      authorize: async () => { throw new Error("revoked"); },
    }, new FixedClock(new Date("2026-07-20T16:02:00.000Z")));
    await expect(service.read(principal, householdId, deviceId, undefined)).rejects.toThrow(/revoked/);
  });
});
