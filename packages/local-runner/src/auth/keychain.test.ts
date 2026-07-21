import { describe, expect, it, vi } from "vitest";
import { MacOSKeychain } from "./keychain.js";

type Execute = NonNullable<ConstructorParameters<typeof MacOSKeychain>[1]>;

describe("MacOSKeychain", () => {
  it("reads, writes, and deletes runner secrets without exposing them in arguments", async () => {
    const execute = vi.fn<Execute>(async () => ({ stdout: "secret-value\n", stderr: "" }));
    const keychain = new MacOSKeychain("runner-account", execute);
    await expect(keychain.read("oauth-refresh-token")).resolves.toBe("secret-value");
    await expect(keychain.write("oauth-client-id", "native-client")).resolves.toBeUndefined();
    await expect(keychain.delete("oauth-refresh-token")).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(3);
    await expect(keychain.write("oauth-client-id", "")).rejects.toThrow(/length/);
    await expect(keychain.write("oauth-client-id", "x".repeat(4_097))).rejects.toThrow(/length/);
  });

  it("treats a missing item as absent and surfaces other Keychain failures", async () => {
    const missing = Object.assign(new Error("missing"), { code: 44 });
    const failed = Object.assign(new Error("failed"), { code: 1 });
    const execute = vi.fn<Execute>()
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(failed)
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(failed);
    const keychain = new MacOSKeychain("runner-account", execute);
    await expect(keychain.read("oauth-refresh-token")).resolves.toBeNull();
    await expect(keychain.read("oauth-refresh-token")).rejects.toThrow(/Unable to read/);
    await expect(keychain.delete("oauth-client-id")).resolves.toBeUndefined();
    await expect(keychain.delete("oauth-client-id")).rejects.toThrow(/Unable to delete/);
  });
});
