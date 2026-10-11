import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GoogleIdTokenVerifier, InvalidIdTokenError } from "./google.js";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const certs = { "kid-1": publicKey.export({ type: "spki", format: "pem" }).toString() };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** A Google-style ID token signed with our test key ("mocked Google keys"). */
function idToken(claims: Record<string, unknown> = {}, key = privateKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: "RS256", kid: "kid-1", typ: "JWT" });
  const payload = b64({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-123",
    iat: now,
    exp: now + 3600,
    ...claims,
  });
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}

const verifier = new GoogleIdTokenVerifier(CLIENT_ID, async () => certs);

describe("GoogleIdTokenVerifier", () => {
  it("accepts a valid token and returns its subject", async () => {
    await expect(verifier.verify(idToken())).resolves.toEqual({ sub: "google-sub-123" });
  });

  it.each([
    ["wrong audience", { aud: "someone-else" }],
    ["wrong issuer", { iss: "https://evil.example" }],
    [
      "expired",
      { exp: Math.floor(Date.now() / 1000) - 600, iat: Math.floor(Date.now() / 1000) - 4200 },
    ],
  ])("rejects a token with %s", async (_, claims) => {
    await expect(verifier.verify(idToken(claims))).rejects.toBeInstanceOf(InvalidIdTokenError);
  });

  it("rejects a token signed with another key", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(verifier.verify(idToken({}, other))).rejects.toBeInstanceOf(InvalidIdTokenError);
  });

  it("rejects garbage", async () => {
    await expect(verifier.verify("not.a.jwt")).rejects.toBeInstanceOf(InvalidIdTokenError);
  });
});
