import { describe, expect, it } from "vitest";
import { AesGcmMessageCipher } from "./cipher.js";

const key = Buffer.alloc(32, 7).toString("base64url");

describe("AesGcmMessageCipher", () => {
  it("round-trips authenticated message text", () => {
    const cipher = new AesGcmMessageCipher(key, () => Buffer.alloc(12, 3));
    const ciphertext = cipher.encrypt("we're out of cashews", "message:one");
    expect(ciphertext).not.toContain("cashews");
    expect(cipher.decrypt(ciphertext, "message:one")).toBe("we're out of cashews");
    expect(() => cipher.decrypt(ciphertext, "message:two")).toThrow();
  });

  it("rejects invalid keys, nonces, and ciphertexts", () => {
    expect(() => new AesGcmMessageCipher("short")).toThrow(/32 bytes/);
    const cipher = new AesGcmMessageCipher(key, () => Buffer.alloc(11));
    expect(() => cipher.encrypt("text", "aad")).toThrow(/nonce/);
    expect(() => new AesGcmMessageCipher(key).decrypt("not-a-ciphertext", "aad")).toThrow();
  });
});
