import cookie from "@fastify/cookie";
import { AuthGoogleRequestSchema, PutHandleRequestSchema } from "@inferno/shared";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { InvalidIdTokenError } from "./auth/google.js";
import { isAllowedOrigin } from "./auth/origin.js";
import { type Auth, SESSION_COOKIE, SESSION_TTL_MS } from "./auth/sessions.js";
import { HandleTakenError, type User, type UserStore } from "./auth/stores.js";
import { hashToken } from "./auth/tokens.js";
import type { GameRoom } from "./room.js";
import type { SocketRegistry } from "./sockets.js";

export interface HttpDeps {
  room: GameRoom;
  /** Null when no Google client id is configured: sign-in answers 503. */
  auth: Auth | null;
  users: UserStore;
  sockets: SocketRegistry;
  /** The game's own origin, e.g. https://inferno.example or http://localhost:5173. */
  allowedOrigin: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
} as const;

export function buildHttp(deps: HttpDeps): FastifyInstance {
  const { room, auth, users, sockets, allowedOrigin } = deps;
  const app = Fastify({ logger: false });
  void app.register(cookie);

  // CSRF defence on top of SameSite: state-changing calls must come from the game's origin.
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "GET" || req.method === "HEAD") return;
    if (!isAllowedOrigin(req.headers.origin, allowedOrigin)) {
      return reply.code(403).send({ error: "BAD_ORIGIN" });
    }
  });

  /** The signed-in user, refreshing the cookie's expiry; replies 401 and returns null if none. */
  async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<User | null> {
    const token = req.cookies[SESSION_COOKIE];
    const user = auth ? await auth.resolve(token) : undefined;
    if (!user || !token) {
      await reply.code(401).send({ error: token ? "INVALID_SESSION" : "NOT_AUTHENTICATED" });
      return null;
    }
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
    return user;
  }

  app.get("/api/v1/health", async () => ({ ok: true as const, leader: true }));

  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/v1/history",
    async (req, reply) => {
      const cursor = req.query.cursor === undefined ? 0 : Number(req.query.cursor);
      const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
      const valid =
        Number.isInteger(cursor) &&
        cursor >= 0 &&
        Number.isInteger(limit) &&
        limit >= 1 &&
        limit <= 500;
      if (!valid) return reply.code(400).send({ error: "BAD_REQUEST" });
      return room.historyPage(cursor, limit);
    },
  );

  app.post("/api/v1/auth/google", async (req, reply) => {
    if (!auth) return reply.code(503).send({ error: "AUTH_NOT_CONFIGURED" });
    const body = AuthGoogleRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "BAD_REQUEST" });
    try {
      const { token, user, isNew } = await auth.signIn(body.data.idToken);
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
      return { user: { id: user.id, handle: user.handle, isNew } };
    } catch (e) {
      if (e instanceof InvalidIdTokenError) {
        return reply.code(401).send({ error: "INVALID_GOOGLE_TOKEN" });
      }
      throw e;
    }
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!(await requireUser(req, reply))) return;
    await auth!.signOut(token);
    sockets.closeSession(hashToken(token!));
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/v1/me", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    return { id: user.id, handle: user.handle };
  });

  app.put("/api/v1/me/handle", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const body = PutHandleRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(422).send({ error: "HANDLE_INVALID" });
    try {
      await users.setHandle(user.id, body.data.handle);
    } catch (e) {
      if (e instanceof HandleTakenError) return reply.code(409).send({ error: "HANDLE_TAKEN" });
      throw e;
    }
    room.renamePlayer(user.id, body.data.handle);
    return { handle: body.data.handle };
  });

  return app;
}
