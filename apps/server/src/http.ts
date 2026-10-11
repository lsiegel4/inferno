import Fastify, { type FastifyInstance } from "fastify";
import type { GameRoom } from "./room.js";

export function buildHttp(room: GameRoom): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/api/v1/health", async () => ({ ok: true as const, leader: true }));

  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/v1/history",
    async (req, reply) => {
      const cursor = req.query.cursor === undefined ? 0 : Number(req.query.cursor);
      const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
      if (
        !Number.isInteger(cursor) ||
        cursor < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 500
      ) {
        return reply.code(400).send({ error: "BAD_REQUEST" });
      }
      return room.historyPage(cursor, limit);
    },
  );

  return app;
}
