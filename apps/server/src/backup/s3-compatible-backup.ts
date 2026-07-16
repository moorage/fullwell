import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BackupPort, Clock } from "../core/ports.js";
import type { BackupCryptography } from "./backup-cryptography.js";

const MAX_ENCRYPTED_BUNDLE_BYTES = 140 * 1024 * 1024;
const MAX_ENCRYPTED_MANIFEST_BYTES = 1024 * 1024;

export interface ObjectStorageClient {
  put(input: { readonly bucket: string; readonly key: string; readonly body: Uint8Array; readonly retention: Date; readonly kind: "bundle" | "manifest" }): Promise<void>;
  head(bucket: string, key: string): Promise<{ readonly contentLength: number | undefined; readonly metadata: Readonly<Record<string, string>>; readonly lockMode: string | undefined; readonly retainedUntil: Date | undefined }>;
  get(bucket: string, key: string): Promise<{ readonly contentLength: number | undefined; readonly content: Uint8Array }>;
}

export interface S3CompatibleBackupOptions {
  readonly endpoint: URL;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly prefix?: string;
}

export class S3CompatibleBackupProvider implements BackupPort {
  private readonly client: ObjectStorageClient;
  private readonly prefix: string;

  constructor(
    private readonly options: S3CompatibleBackupOptions,
    private readonly cryptography: BackupCryptography,
    private readonly clock: Clock,
    client?: ObjectStorageClient,
  ) {
    this.prefix = normalizePrefix(options.prefix ?? "household-food-journal/v1");
    this.client = client ?? new AwsS3ObjectStorageClient(new S3Client({
      endpoint: options.endpoint.toString(),
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }));
  }

  async upload(input: Parameters<BackupPort["upload"]>[0]): Promise<{ objectKey: string; manifestObjectKey: string; verifiedAt: string }> {
    const [encryptedBundle, encryptedManifest] = await Promise.all([
      this.cryptography.encrypt(input.bundle, "bundle"),
      this.cryptography.encrypt(Buffer.from(input.signedManifest), "manifest"),
    ]);
    if (encryptedBundle.byteLength > MAX_ENCRYPTED_BUNDLE_BYTES) throw new Error("Encrypted backup bundle exceeds the storage limit");
    const version = `${input.completedAt.replaceAll(/[-:.]/g, "")}-${input.repositoryHead}`;
    const base = `${this.prefix}/households/${input.householdId}/${version}`;
    const objectKey = `${base}.bundle.jwe`;
    const manifestObjectKey = `${base}.manifest.jwe`;
    const retention = new Date(input.retainedUntil);

    await this.put(objectKey, encryptedBundle, retention, "bundle");
    await this.put(manifestObjectKey, encryptedManifest, retention, "manifest");
    await Promise.all([
      this.verifyHead(objectKey, encryptedBundle, retention, "bundle"),
      this.verifyHead(manifestObjectKey, encryptedManifest, retention, "manifest"),
    ]);
    return { objectKey, manifestObjectKey, verifiedAt: this.clock.now().toISOString() };
  }

  async download(objectKey: string, manifestObjectKey: string): Promise<{ bundle: Uint8Array; signedManifest: string }> {
    validateObjectKey(this.prefix, objectKey);
    validateObjectKey(this.prefix, manifestObjectKey);
    const [encryptedBundle, encryptedManifest] = await Promise.all([
      this.get(objectKey, MAX_ENCRYPTED_BUNDLE_BYTES),
      this.get(manifestObjectKey, MAX_ENCRYPTED_MANIFEST_BYTES),
    ]);
    const [bundle, manifest] = await Promise.all([
      this.cryptography.decrypt(encryptedBundle, "bundle"),
      this.cryptography.decrypt(encryptedManifest, "manifest"),
    ]);
    return { bundle, signedManifest: Buffer.from(manifest).toString("utf8") };
  }

  private async put(key: string, body: Uint8Array, retention: Date, kind: "bundle" | "manifest"): Promise<void> {
    await this.client.put({ bucket: this.options.bucket, key, body, retention, kind });
  }

  private async verifyHead(key: string, expected: Uint8Array, retention: Date, kind: "bundle" | "manifest"): Promise<void> {
    const result = await this.client.head(this.options.bucket, key);
    const retainedUntil = result.retainedUntil?.getTime() ?? 0;
    if (result.contentLength !== expected.byteLength || result.metadata.sha256 !== sha256(expected) || result.metadata.kind !== kind) {
      throw new Error("Object storage did not preserve backup integrity metadata");
    }
    if (result.lockMode !== "COMPLIANCE" || retainedUntil < retention.getTime()) throw new Error("Object storage did not confirm immutable retention");
  }

  private async get(key: string, limit: number): Promise<Uint8Array> {
    const result = await this.client.get(this.options.bucket, key);
    if (result.contentLength === undefined || result.contentLength > limit) throw new Error("Stored backup object has an invalid size");
    if (result.content.byteLength !== result.contentLength) throw new Error("Stored backup object was truncated");
    return result.content;
  }
}

class AwsS3ObjectStorageClient implements ObjectStorageClient {
  constructor(private readonly client: S3Client) {}

  async put(input: Parameters<ObjectStorageClient["put"]>[0]): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentMD5: createHash("md5").update(input.body).digest("base64"),
      ContentType: "application/jose",
      Metadata: { sha256: sha256(input.body), kind: input.kind },
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: input.retention,
    }));
  }

  async head(bucket: string, key: string): Promise<{ contentLength: number | undefined; metadata: Readonly<Record<string, string>>; lockMode: string | undefined; retainedUntil: Date | undefined }> {
    const output = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentLength: output.ContentLength, metadata: output.Metadata ?? {}, lockMode: output.ObjectLockMode, retainedUntil: output.ObjectLockRetainUntilDate };
  }

  async get(bucket: string, key: string): Promise<{ contentLength: number | undefined; content: Uint8Array }> {
    const output = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (output.Body === undefined) throw new Error("Stored backup object has no body");
    return { contentLength: output.ContentLength, content: await output.Body.transformToByteArray() };
  }
}

function sha256(input: Uint8Array): string { return createHash("sha256").update(input).digest("hex"); }

function normalizePrefix(prefix: string): string {
  const normalized = prefix.replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(normalized) || normalized.includes("..") || normalized.includes("//")) throw new Error("Backup object prefix is invalid");
  return normalized;
}

function validateObjectKey(prefix: string, key: string): void {
  if (!key.startsWith(`${prefix}/households/`) || key.includes("..") || key.length > 900) throw new Error("Backup object key is outside the configured prefix");
}
