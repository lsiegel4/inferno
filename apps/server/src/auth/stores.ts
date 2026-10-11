/**
 * User and session storage. In memory for now; DynamoDB implementations replace these in
 * Phase 4 behind the same interfaces.
 */
export interface User {
  id: string;
  googleSub: string;
  handle: string;
}

export interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  /** Last time the expiry was pushed forward (sliding renewal). */
  renewedAt: number;
}

export interface UserStore {
  findBySub(sub: string): Promise<User | undefined>;
  get(id: string): Promise<User | undefined>;
  /** Fails with HandleTakenError if the handle is in use (case-insensitive). */
  create(user: User): Promise<void>;
  setHandle(id: string, handle: string): Promise<void>;
  isHandleTaken(handle: string): Promise<boolean>;
}

export interface SessionStore {
  put(session: Session): Promise<void>;
  get(tokenHash: string): Promise<Session | undefined>;
  delete(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}

export class HandleTakenError extends Error {}

export class MemoryUserStore implements UserStore {
  private readonly byId = new Map<string, User>();

  async findBySub(sub: string) {
    return [...this.byId.values()].find((u) => u.googleSub === sub);
  }

  async get(id: string) {
    return this.byId.get(id);
  }

  async create(user: User) {
    if (await this.isHandleTaken(user.handle)) throw new HandleTakenError(user.handle);
    this.byId.set(user.id, { ...user });
  }

  async setHandle(id: string, handle: string) {
    const user = this.byId.get(id);
    if (!user) throw new Error(`unknown user ${id}`);
    if (user.handle.toLowerCase() !== handle.toLowerCase() && (await this.isHandleTaken(handle))) {
      throw new HandleTakenError(handle);
    }
    user.handle = handle;
  }

  async isHandleTaken(handle: string) {
    const h = handle.toLowerCase();
    return [...this.byId.values()].some((u) => u.handle.toLowerCase() === h);
  }
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  async put(session: Session) {
    this.sessions.set(session.tokenHash, { ...session });
  }

  async get(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    return s ? { ...s } : undefined;
  }

  async delete(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async deleteAllForUser(userId: string) {
    for (const [k, s] of this.sessions) if (s.userId === userId) this.sessions.delete(k);
  }
}
