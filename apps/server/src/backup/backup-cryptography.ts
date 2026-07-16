import { CompactEncrypt, CompactSign, compactDecrypt, compactVerify, importPKCS8, importSPKI } from "jose";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { z } from "zod";

const ProtectedHeaderSchema = z.object({ alg: z.string(), typ: z.string() }).passthrough();

export class BackupCryptography {
  private readonly encryptionKey: Uint8Array;

  constructor(
    encryptionKey: string,
    private readonly manifestPrivateKey: string,
    private readonly manifestPublicKey: string,
    private readonly keyId: string,
  ) {
    this.encryptionKey = parseEncryptionKey(encryptionKey);
    const privateKey = createPrivateKey(manifestPrivateKey);
    const publicKey = createPublicKey(manifestPublicKey);
    const probe = Buffer.from("hfj-backup-key-validation");
    if (privateKey.asymmetricKeyType !== "ed25519" || publicKey.asymmetricKeyType !== "ed25519" || !verify(null, probe, publicKey, sign(null, probe, privateKey))) {
      throw new Error("Backup manifest keys must be Ed25519 keys");
    }
  }

  async signManifest(manifest: string): Promise<string> {
    const key = await importPKCS8(this.manifestPrivateKey, "EdDSA");
    return await new CompactSign(Buffer.from(manifest))
      .setProtectedHeader({ alg: "EdDSA", typ: "hfj-backup-manifest+json", kid: this.keyId })
      .sign(key);
  }

  async verifyManifest(signedManifest: string): Promise<string> {
    const key = await importSPKI(this.manifestPublicKey, "EdDSA");
    const result = await compactVerify(signedManifest, key, { algorithms: ["EdDSA"] });
    const header = ProtectedHeaderSchema.parse(result.protectedHeader);
    if (header.typ !== "hfj-backup-manifest+json" || result.protectedHeader.kid !== this.keyId) throw new Error("Backup manifest signature metadata is invalid");
    return Buffer.from(result.payload).toString("utf8");
  }

  async encrypt(content: Uint8Array, type: "bundle" | "manifest"): Promise<Uint8Array> {
    const compact = await new CompactEncrypt(content)
      .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: `hfj-backup-${type}+jwe`, kid: this.keyId })
      .encrypt(this.encryptionKey);
    return Buffer.from(compact);
  }

  async decrypt(content: Uint8Array, type: "bundle" | "manifest"): Promise<Uint8Array> {
    const result = await compactDecrypt(Buffer.from(content).toString("utf8"), this.encryptionKey, {
      keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"],
    });
    const header = ProtectedHeaderSchema.parse(result.protectedHeader);
    if (header.typ !== `hfj-backup-${type}+jwe` || result.protectedHeader.kid !== this.keyId) throw new Error("Backup encryption metadata is invalid");
    return result.plaintext;
  }
}

function parseEncryptionKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("BACKUP_ENCRYPTION_KEY must be an unpadded base64url 32-byte key");
  const key = Buffer.from(value, "base64url");
  if (key.byteLength !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
