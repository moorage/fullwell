import { describe, expect, it, vi } from "vitest";
import { revokeWithRequiredLocalPurge } from "./cli.js";

describe("revokeWithRequiredLocalPurge", () => {
  it("purges local state when remote revocation fails", async () => {
    const purge = vi.fn(async () => undefined);

    await expect(revokeWithRequiredLocalPurge(
      async () => { throw new Error("gateway unavailable"); },
      purge,
    )).rejects.toThrow("gateway unavailable");

    expect(purge).toHaveBeenCalledOnce();
  });

  it("waits for remote revocation before purging local state", async () => {
    const order: string[] = [];

    await revokeWithRequiredLocalPurge(
      async () => { order.push("revoke"); },
      async () => { order.push("purge"); },
    );

    expect(order).toEqual(["revoke", "purge"]);
  });
});
