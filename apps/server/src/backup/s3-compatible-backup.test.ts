import { createHash, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { HouseholdIdSchema, GitObjectIdSchema } from "@hfj/contracts";
import { FixedClock } from "../adapters/providers.js";
import { BackupCryptography } from "./backup-cryptography.js";
import { S3CompatibleBackupProvider, type ObjectStorageClient } from "./s3-compatible-backup.js";

class MemoryObjectStorage implements ObjectStorageClient {
  readonly objects = new Map<string, { body: Uint8Array; retention: Date; kind: "bundle" | "manifest" }>();
  lockMode = "COMPLIANCE";
  corruptMetadata = false;
  truncateDownload = false;
  omitLength = false;
  async put(input: Parameters<ObjectStorageClient["put"]>[0]): Promise<void> { this.objects.set(input.key, { body: input.body, retention: input.retention, kind: input.kind }); }
  async head(_bucket: string, key: string) {
    const object = this.object(key);
    return {
      contentLength: object.body.byteLength,
      metadata: { sha256: this.corruptMetadata ? "0".repeat(64) : createHash("sha256").update(object.body).digest("hex"), kind: object.kind },
      lockMode: this.lockMode,
      retainedUntil: object.retention,
    };
  }
  async get(_bucket: string, key: string) {
    const object = this.object(key);
    return { contentLength: this.omitLength ? undefined : object.body.byteLength, content: this.truncateDownload ? object.body.slice(1) : object.body };
  }
  private object(key: string) {
    const object = this.objects.get(key);
    if (object === undefined) throw new Error("Object was not found");
    return object;
  }
}

describe("S3CompatibleBackupProvider", () => {
  it("encrypts both objects, requires compliance retention, and restores plaintext", async () => {
    const storage = new MemoryObjectStorage();
    const provider = createProvider(storage);
    const receipt = await provider.upload({
      householdId: HouseholdIdSchema.parse("hsh_0000000000000501"),
      repositoryHead: GitObjectIdSchema.parse("a".repeat(40)),
      bundle: Buffer.from("git bundle bytes"),
      signedManifest: "signed-manifest",
      completedAt: "2026-07-15T12:00:00.000Z",
      retainedUntil: "2026-08-19T12:00:00.000Z",
    });

    expect(storage.objects.size).toBe(2);
    expect([...storage.objects.values()].every((object) => !Buffer.from(object.body).toString("utf8").includes("git bundle bytes"))).toBe(true);
    const restored = await provider.download(receipt.objectKey, receipt.manifestObjectKey);
    expect(Buffer.from(restored.bundle)).toEqual(Buffer.from("git bundle bytes"));
    expect(restored.signedManifest).toBe("signed-manifest");
  });

  it("fails closed when the provider does not confirm immutable retention", async () => {
    const storage = new MemoryObjectStorage();
    storage.lockMode = "GOVERNANCE";
    await expect(createProvider(storage).upload({
      householdId: HouseholdIdSchema.parse("hsh_0000000000000502"), repositoryHead: GitObjectIdSchema.parse("b".repeat(40)),
      bundle: Buffer.from("bundle"), signedManifest: "manifest", completedAt: "2026-07-15T12:00:00.000Z", retainedUntil: "2026-08-19T12:00:00.000Z",
    })).rejects.toThrow(/immutable retention/);
  });

  it("rejects invalid prefixes, escaped keys, corrupted metadata, and truncated objects", async () => {
    const storage = new MemoryObjectStorage();
    expect(() => createProvider(storage, "../escaped")).toThrow(/prefix/);
    const provider = createProvider(storage);
    await expect(provider.download("other/household.bundle.jwe", "other/household.manifest.jwe")).rejects.toThrow(/outside/);
    storage.corruptMetadata = true;
    await expect(provider.upload({
      householdId: HouseholdIdSchema.parse("hsh_0000000000000503"), repositoryHead: GitObjectIdSchema.parse("c".repeat(40)),
      bundle: Buffer.from("bundle"), signedManifest: "manifest", completedAt: "2026-07-15T12:00:00.000Z", retainedUntil: "2026-08-19T12:00:00.000Z",
    })).rejects.toThrow(/integrity metadata/);
    storage.corruptMetadata = false;
    const receipt = await provider.upload({
      householdId: HouseholdIdSchema.parse("hsh_0000000000000504"), repositoryHead: GitObjectIdSchema.parse("d".repeat(40)),
      bundle: Buffer.from("bundle"), signedManifest: "manifest", completedAt: "2026-07-15T12:00:00.000Z", retainedUntil: "2026-08-19T12:00:00.000Z",
    });
    storage.truncateDownload = true;
    await expect(provider.download(receipt.objectKey, receipt.manifestObjectKey)).rejects.toThrow(/truncated/);
    storage.truncateDownload = false;
    storage.omitLength = true;
    await expect(provider.download(receipt.objectKey, receipt.manifestObjectKey)).rejects.toThrow(/invalid size/);
  });

  it("constructs the production AWS SDK client without performing network I/O", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const cryptography = new BackupCryptography(Buffer.alloc(32, 4).toString("base64url"), privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey.export({ type: "spki", format: "pem" }).toString(), "test-key");
    expect(new S3CompatibleBackupProvider({ endpoint: new URL("https://s3.us-west-004.backblazeb2.com"), region: "us-west-004", bucket: "fullwell-test", accessKeyId: "key-id", secretAccessKey: "secret" }, cryptography, new FixedClock(new Date()))).toBeInstanceOf(S3CompatibleBackupProvider);
  });

  it("uses the real AWS SDK client against an S3-compatible HTTP boundary", async () => {
    const stub = await startS3Stub();
    try {
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      const cryptography = new BackupCryptography(Buffer.alloc(32, 3).toString("base64url"), privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey.export({ type: "spki", format: "pem" }).toString(), "sdk-test-key");
      const provider = new S3CompatibleBackupProvider({ endpoint: stub.endpoint, region: "us-west-004", bucket: "fullwell-test", accessKeyId: "key-id", secretAccessKey: "secret" }, cryptography, new FixedClock(new Date("2026-07-15T12:05:00.000Z")));
      const receipt = await provider.upload({
        householdId: HouseholdIdSchema.parse("hsh_0000000000000505"), repositoryHead: GitObjectIdSchema.parse("e".repeat(40)),
        bundle: Buffer.from("sdk bundle"), signedManifest: "sdk manifest", completedAt: "2026-07-15T12:00:00.000Z", retainedUntil: "2026-08-19T12:00:00.000Z",
      });
      const restored = await provider.download(receipt.objectKey, receipt.manifestObjectKey);
      expect(Buffer.from(restored.bundle).toString()).toBe("sdk bundle");
      expect(restored.signedManifest).toBe("sdk manifest");
      expect(stub.authorizationObserved()).toBe(true);
    } finally {
      await stub.close();
    }
  });
});

function createProvider(storage: ObjectStorageClient, prefix?: string): S3CompatibleBackupProvider {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const cryptography = new BackupCryptography(
    Buffer.alloc(32, 5).toString("base64url"),
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey.export({ type: "spki", format: "pem" }).toString(),
    "test-key",
  );
  return new S3CompatibleBackupProvider({ endpoint: new URL("https://s3.us-west-004.backblazeb2.com"), region: "us-west-004", bucket: "fullwell-test", accessKeyId: "key-id", secretAccessKey: "secret", ...(prefix === undefined ? {} : { prefix }) }, cryptography, new FixedClock(new Date("2026-07-15T12:05:00.000Z")), storage);
}

async function startS3Stub(): Promise<{ endpoint: URL; authorizationObserved: () => boolean; close: () => Promise<void> }> {
  const objects = new Map<string, { body: Buffer; metadataSha256: string; kind: string; retainedUntil: string }>();
  let authorizationObserved = false;
  const server = createServer((request, response) => {
    const key = new URL(request.url ?? "/", "http://local.test").pathname;
    authorizationObserved ||= request.headers.authorization?.startsWith("AWS4-HMAC-SHA256") === true;
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        objects.set(key, {
          body: Buffer.concat(chunks),
          metadataSha256: String(request.headers["x-amz-meta-sha256"]),
          kind: String(request.headers["x-amz-meta-kind"]),
          retainedUntil: String(request.headers["x-amz-object-lock-retain-until-date"]),
        });
        response.statusCode = 200;
        response.setHeader("etag", '"test-etag"');
        response.end();
      });
      return;
    }
    const object = objects.get(key);
    if (object === undefined) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }
    response.setHeader("content-length", object.body.byteLength);
    response.setHeader("x-amz-meta-sha256", object.metadataSha256);
    response.setHeader("x-amz-meta-kind", object.kind);
    response.setHeader("x-amz-object-lock-mode", "COMPLIANCE");
    response.setHeader("x-amz-object-lock-retain-until-date", object.retainedUntil);
    response.statusCode = 200;
    response.end(request.method === "HEAD" ? undefined : object.body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("S3 test server did not expose a TCP address");
  return {
    endpoint: new URL(`http://127.0.0.1:${address.port}`),
    authorizationObserved: () => authorizationObserved,
    close: async () => await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error))),
  };
}
