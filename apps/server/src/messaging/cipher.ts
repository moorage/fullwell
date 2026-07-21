import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import type { MessageCipherPort } from "./ports.js";

const CiphertextSchema = z.tuple([
  z.literal("v1"),
  z.string().min(16).max(32),
  z.string().min(1).max(16_000),
  z.string().min(16).max(32),
]);

export class AesGcmMessageCipher implements MessageCipherPort {
  private readonly key: Buffer;

  constructor(encodedKey: string, private readonly nonce: (size: number) => Buffer = randomBytes) {
    this.key = Buffer.from(encodedKey, "base64url");
    if (this.key.length !== 32) throw new Error("MESSAGE_ENCRYPTION_KEY must contain exactly 32 bytes");
  }

  encrypt(plaintext: string, associatedData: string): string {
    const iv = this.nonce(12);
    if (iv.length !== 12) throw new Error("Message cipher nonce source returned an invalid nonce");
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(associatedData, "utf8"));
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  }

  decrypt(ciphertext: string, associatedData: string): string {
    const [version, encodedIv, encodedBody, encodedTag] = CiphertextSchema.parse(ciphertext.split("."));
    if (version !== "v1") throw new Error("Unsupported message ciphertext version");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(encodedIv, "base64url"));
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encodedBody, "base64url")), decipher.final()]).toString("utf8");
  }
}
