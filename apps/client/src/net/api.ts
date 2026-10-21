/** REST calls (api-contracts §3). Same origin, so the session cookie is sent automatically. */
export interface Me {
  id: string;
  handle: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? "UNKNOWN");
  return json as T;
}

export const api = {
  /** The signed-in user, or null. Also slides the session cookie's expiry (call on load). */
  async me(): Promise<Me | null> {
    try {
      return await call<Me>("GET", "/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  signIn: (idToken: string) =>
    call<{ user: Me & { isNew: boolean } }>("POST", "/auth/google", { idToken }),
  logout: () => call<void>("POST", "/auth/logout"),
  setHandle: (handle: string) => call<{ handle: string }>("PUT", "/me/handle", { handle }),
};
