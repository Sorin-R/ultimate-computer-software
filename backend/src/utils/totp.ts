import crypto from "crypto";
import { sha256Hex, constantTimeEquals } from "./security";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const sanitized = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of sanitized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): number {
  const counterBuffer = Buffer.alloc(8);
  let moving = counter;

  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = moving & 0xff;
    moving = moving >> 8;
  }

  const hmac = crypto.createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return code % 1_000_000;
}

function normalizeCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUrl(secret: string, accountName: string, issuer: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotpCode(secretBase32: string, rawCode: string, window = 1): boolean {
  const code = normalizeCode(rawCode);
  if (code.length !== 6) return false;

  const secret = base32Decode(secretBase32);
  if (secret.length === 0) return false;

  const nowStep = Math.floor(Date.now() / 30_000);
  for (let drift = -window; drift <= window; drift++) {
    const candidate = hotp(secret, nowStep + drift).toString().padStart(6, "0");
    if (constantTimeEquals(candidate, code)) {
      return true;
    }
  }
  return false;
}

function formatRecoveryCode(raw: Buffer): string {
  const hex = raw.toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(formatRecoveryCode(crypto.randomBytes(4)));
  }
  return codes;
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(normalizeRecoveryCode(code));
}

export function consumeRecoveryCode(
  rawCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const hash = hashRecoveryCode(rawCode);
  const index = hashedCodes.findIndex((value) => constantTimeEquals(value, hash));
  if (index < 0) {
    return { valid: false, remainingHashedCodes: hashedCodes };
  }

  const remaining = [...hashedCodes.slice(0, index), ...hashedCodes.slice(index + 1)];
  return { valid: true, remainingHashedCodes: remaining };
}
