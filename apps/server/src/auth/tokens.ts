import { createHash, randomBytes } from "node:crypto";

/** A new opaque session token: 256 random bits, URL-safe (ADR-0018). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a leaked session table cannot be used to sign in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
