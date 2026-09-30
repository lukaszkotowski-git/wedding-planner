import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Losowy token base62; 22 znaki ≈ 131 bitów. */
export function randomToken(length = 22): string {
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const b = bytes[i]!;
    if (b < 248) out += ALPHABET[b % 62]; // odrzucamy nadmiar, żeby rozkład był równy
  }
  return out.length === length ? out : randomToken(length);
}

/** Skrót IP do rejestru zgód (nie przechowujemy surowego adresu). */
export function hashIp(ip: string | undefined, salt: string): string | null {
  return ip ? createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32) : null;
}
