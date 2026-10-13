import { describe, expect, it } from "vitest";
import { FakeClock, fakeVerifier } from "../testing.js";
import { InvalidIdTokenError } from "./google.js";
import { Auth, SESSION_RENEW_INTERVAL_MS, SESSION_TTL_MS } from "./sessions.js";
import { MemorySessionStore, MemoryUserStore } from "./stores.js";
import { hashToken } from "./tokens.js";

function setup() {
  const clock = new FakeClock();
  const users = new MemoryUserStore();
  const sessions = new MemorySessionStore();
  return { clock, users, sessions, auth: new Auth(users, sessions, fakeVerifier, clock) };
}

describe("Auth", () => {
  it("creates a user with a valid random handle on first sign-in, reuses it after", async () => {
    const { auth } = setup();
    const first = await auth.signIn("good:alice");
    expect(first.isNew).toBe(true);
    expect(first.user.handle).toMatch(/^[A-Za-z0-9_]{3,20}$/);
    const second = await auth.signIn("good:alice");
    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
  });

  it("stores only a hash of the session token", async () => {
    const { auth, sessions } = setup();
    const { token } = await auth.signIn("good:alice");
    expect(await sessions.get(token)).toBeUndefined();
    expect(await sessions.get(hashToken(token))).toBeDefined();
  });

  it("resolves sessions and renews the 30-day expiry as they are used", async () => {
    const { auth, clock } = setup();
    const { token, user } = await auth.signIn("good:alice");
    // Used every 20 days: each use slides the expiry, so it never lapses.
    for (let i = 0; i < 5; i++) {
      clock.advance(20 * 24 * 3600_000);
      expect((await auth.resolve(token))?.id).toBe(user.id);
    }
  });

  it("expires after 30 days without use", async () => {
    const { auth, clock } = setup();
    const { token } = await auth.signIn("good:alice");
    clock.advance(SESSION_TTL_MS - 1);
    expect(await auth.resolve(token)).toBeDefined();
    clock.advance(SESSION_TTL_MS); // renewed above, so this is 30 days after the last use
    expect(await auth.resolve(token)).toBeUndefined();
  });

  it("renews at most once per day", async () => {
    const { auth, clock, sessions } = setup();
    const { token } = await auth.signIn("good:alice");
    const before = (await sessions.get(hashToken(token)))!.expiresAt;
    clock.advance(SESSION_RENEW_INTERVAL_MS - 1);
    await auth.resolve(token);
    expect((await sessions.get(hashToken(token)))!.expiresAt).toBe(before);
    clock.advance(1);
    await auth.resolve(token);
    expect((await sessions.get(hashToken(token)))!.expiresAt).toBe(
      before + SESSION_RENEW_INTERVAL_MS,
    );
  });

  it("signs out one session, or revokes all of a user's sessions", async () => {
    const { auth } = setup();
    const a = await auth.signIn("good:alice");
    const b = await auth.signIn("good:alice");
    await auth.signOut(a.token);
    expect(await auth.resolve(a.token)).toBeUndefined();
    expect(await auth.resolve(b.token)).toBeDefined();
    await auth.revokeAll(b.user.id);
    expect(await auth.resolve(b.token)).toBeUndefined();
  });

  it("rejects invalid Google tokens", async () => {
    const { auth } = setup();
    await expect(auth.signIn("bad")).rejects.toBeInstanceOf(InvalidIdTokenError);
  });
});
