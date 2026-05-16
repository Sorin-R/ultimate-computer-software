import crypto from "crypto";
import { env } from "../config/env";

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

function encryptionKey(): Buffer {
  const source = env.TWO_FACTOR_ENCRYPTION_KEY || env.JWT_SECRET;
  return crypto.createHash("sha256").update(source).digest();
}

export function randomTokenUrlSafe(bytes = 32): string {
  return toBase64Url(crypto.randomBytes(bytes));
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = encryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted payload");
  }

  const iv = fromBase64Url(parts[1]);
  const tag = fromBase64Url(parts[2]);
  const ciphertext = fromBase64Url(parts[3]);

  const key = encryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
