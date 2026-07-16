import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BackupCryptography } from "./backup-cryptography.js";

describe("BackupCryptography", () => {
  it("round trips authenticated encryption and Ed25519 manifest signatures", async () => {
    const cryptography = createCryptography("key-a");
    const content = Buffer.from("private household backup");
    const encrypted = await cryptography.encrypt(content, "bundle");
    expect(Buffer.from(encrypted).toString("utf8")).not.toContain("private household backup");
    expect(Buffer.from(await cryptography.decrypt(encrypted, "bundle"))).toEqual(content);

    const signed = await cryptography.signManifest('{"schema_version":1}\n');
    await expect(cryptography.verifyManifest(signed)).resolves.toBe('{"schema_version":1}\n');
    await expect(createCryptography("key-b").verifyManifest(signed)).rejects.toThrow();
  });

  it("rejects malformed keys and mismatched encrypted object types", async () => {
    expect(() => new BackupCryptography("short", "private", "public", "key-a")).toThrow(/32-byte/);
    expect(() => new BackupCryptography(Buffer.alloc(32, 1).toString("base64url"), "private", "public", "key-a")).toThrow();
    const ed25519 = generateKeyPairSync("ed25519");
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => new BackupCryptography(
      Buffer.alloc(32, 1).toString("base64url"),
      ed25519.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      rsa.publicKey.export({ type: "spki", format: "pem" }).toString(),
      "key-a",
    )).toThrow(/Ed25519/);
    const otherEd25519 = generateKeyPairSync("ed25519");
    expect(() => new BackupCryptography(
      Buffer.alloc(32, 1).toString("base64url"),
      ed25519.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      otherEd25519.publicKey.export({ type: "spki", format: "pem" }).toString(),
      "key-a",
    )).toThrow(/Ed25519/);
    const cryptography = createCryptography("key-a");
    const encrypted = await cryptography.encrypt(Buffer.from("content"), "manifest");
    await expect(cryptography.decrypt(encrypted, "bundle")).rejects.toThrow(/metadata/);
  });

  it("binds signatures and ciphertext to the configured key identifier", async () => {
    const keyPair = generateKeyPairSync("ed25519");
    const source = createCryptography("key-a", keyPair);
    const otherIdentifier = createCryptography("key-b", keyPair);
    await expect(otherIdentifier.verifyManifest(await source.signManifest("manifest"))).rejects.toThrow(/metadata/);
    await expect(otherIdentifier.decrypt(await source.encrypt(Buffer.from("content"), "bundle"), "bundle")).rejects.toThrow(/metadata/);
  });
});

function createCryptography(keyId: string, keyPair = generateKeyPairSync("ed25519")): BackupCryptography {
  const { privateKey, publicKey } = keyPair;
  return new BackupCryptography(
    Buffer.alloc(32, 9).toString("base64url"),
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey.export({ type: "spki", format: "pem" }).toString(),
    keyId,
  );
}
