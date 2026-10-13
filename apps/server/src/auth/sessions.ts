import { randomUUID } from "node:crypto";
import type { Clock } from "../clock.js";
import type { IdTokenVerifier } from "./google.js";
import { randomHandle } from "./handles.js";
import { HandleTakenError, type SessionStore, type User, type UserStore } from "./stores.js";
import { hashToken, newSessionToken } from "./tokens.js";

export const SESSION_COOKIE = "inferno_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding expiry is pushed forward at most this often, to avoid a write on every request. */
export const SESSION_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SignInResult {
  token: string;
  user: User;
  isNew: boolean;
}

/** Sign-in, session lookup with sliding renewal, and revocation (ADR-0010, ADR-0018). */
export class Auth {
  constructor(
    private readonly users: UserStore,
    private readonly sessions: SessionStore,
    private readonly verifier: IdTokenVerifier,
    private readonly clock: Clock,
  ) {}

  /** Verify a Google ID token, find or create the user, and start a session. */
  async signIn(idToken: string): Promise<SignInResult> {
    const { sub } = await this.verifier.verify(idToken);
    let user = await this.users.findBySub(sub);
    const isNew = !user;
    if (!user) user = await this.createUser(sub);
    const token = newSessionToken();
    const now = this.clock.now();
    await this.sessions.put({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: now + SESSION_TTL_MS,
      renewedAt: now,
    });
    return { token, user, isNew };
  }

  /** The signed-in user for a session token, renewing the sliding expiry; undefined if invalid. */
  async resolve(token: string | undefined): Promise<User | undefined> {
    if (!token) return undefined;
    const tokenHash = hashToken(token);
    const session = await this.sessions.get(tokenHash);
    const now = this.clock.now();
    if (!session) return undefined;
    if (session.expiresAt <= now) {
      await this.sessions.delete(tokenHash);
      return undefined;
    }
    if (now - session.renewedAt >= SESSION_RENEW_INTERVAL_MS) {
      await this.sessions.put({ ...session, expiresAt: now + SESSION_TTL_MS, renewedAt: now });
    }
    return this.users.get(session.userId);
  }

  async signOut(token: string | undefined): Promise<void> {
    if (token) await this.sessions.delete(hashToken(token));
  }

  /** Revoke every session of a user (bans, account deletion). */
  async revokeAll(userId: string): Promise<void> {
    await this.sessions.deleteAllForUser(userId);
  }

  private async createUser(sub: string): Promise<User> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const user: User = { id: randomUUID(), googleSub: sub, handle: randomHandle() };
      try {
        await this.users.create(user);
        return user;
      } catch (e) {
        if (!(e instanceof HandleTakenError)) throw e;
      }
    }
    throw new Error("could not find a free random handle");
  }
}
