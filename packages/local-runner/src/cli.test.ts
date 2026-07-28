import { describe, expect, it, vi } from "vitest";
import { parseRunnerBrowserBackend, parseRunnerHost } from "./config.js";
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

describe("parseRunnerBrowserBackend", () => {
  it("accepts only an explicitly supported background browser", () => {
    expect(parseRunnerBrowserBackend("chrome")).toBe("chrome");
    expect(parseRunnerBrowserBackend("safari")).toBe("safari");
    expect(() => parseRunnerBrowserBackend("firefox")).toThrow(/does not substitute/);
    expect(parseRunnerHost("codex", "safari")).toBe("codex");
    expect(parseRunnerHost("claude", "chrome")).toBe("claude");
    expect(() => parseRunnerHost("claude", "safari")).toThrow(/Codex Computer Use/);
    expect(() => parseRunnerHost("other", "chrome")).toThrow();
  });
});
