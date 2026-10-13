/** Live sockets per session, so logging out can close that session's connections. */
export class SocketRegistry {
  private readonly bySession = new Map<string, Set<{ close(code?: number): void }>>();

  add(tokenHash: string, socket: { close(code?: number): void }): () => void {
    let set = this.bySession.get(tokenHash);
    if (!set) this.bySession.set(tokenHash, (set = new Set()));
    set.add(socket);
    return () => {
      set.delete(socket);
      if (set.size === 0) this.bySession.delete(tokenHash);
    };
  }

  closeSession(tokenHash: string): void {
    for (const s of this.bySession.get(tokenHash) ?? []) s.close(4001);
  }
}
