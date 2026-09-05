import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { GameError } from "./errors";
import { evaluateGuess } from "./services/guess";
import { createPlayer, getOrCreateSession } from "./services/session";
import { listCities } from "./services/cities";

const PORT = Number(process.env.PORT ?? 3000);
// Containers route to the pod's own address, so binding to localhost would make
// the service unreachable from outside it.
const HOST = process.env.HOST ?? "0.0.0.0";

// When set, the built web app is served from this directory on the same origin
// as the API. Same origin is the point: the browser asks for /api/... and gets
// it without CORS, and no build-time API URL has to be baked into the bundle.
// Unset in development, where Vite serves the front end and proxies /api here.
const WEB_ROOT = process.env.WEB_ROOT;

const app = Fastify({ logger: true });

/**
 * Turn a thrown error into a response.
 *
 * A GameError is an expected outcome of play ("already completed"), so its code
 * and message go to the client. Anything else is a bug or an outage: it is
 * logged with its stack and the client gets a generic 500, because internal
 * messages leak schema and connection details.
 */
function fail(res: any, err: unknown) {
  if (err instanceof GameError) {
    return res.status(400).send({ code: err.code, error: err.message });
  }
  app.log.error(err);
  return res.status(500).send({ code: "INTERNAL", error: "Something went wrong" });
}

async function start() {
  // Blunt per-IP ceiling. The game is anonymous, so there is no better key than
  // the address; the limit is set well above what a person clicking through a
  // puzzle can reach.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    // Trust the proxy's client address — behind a host's load balancer every
    // request otherwise shares one source IP and the limit becomes global.
    keyGenerator: (req) =>
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip,
  });

  await app.register(async (api) => {
  api.get("/health", async () => {
    return { status: "maple-map API running" };
  });

  api.get("/cities", async (req, res) => {
    try {
      res.send(await listCities());
    } catch (err) {
      return fail(res, err);
    }
  });

  // Tighter than the global limit: each call writes a Player row, so this is
  // the one endpoint where a script can grow the database unboundedly.
  api.post("/player", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (req, res) => {
    try {
      res.send(await createPlayer());
    } catch (err) {
      return fail(res, err);
    }
  });

  api.post("/session", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };

      if (!playerId) {
        throw new GameError("MISSING_FIELDS", "Missing playerId");
      }

      res.send(await getOrCreateSession(playerId));
    } catch (err) {
      return fail(res, err);
    }
  });

  api.post("/guess", async (req, res) => {
    try {
      const { sessionId, cityId, city } = req.body as {
        sessionId?: string;
        cityId?: number;
        city?: string;
      };

      if (!sessionId || (cityId === undefined && !city)) {
        throw new GameError("MISSING_FIELDS", "Missing sessionId or city");
      }

      res.send(await evaluateGuess(sessionId, { cityId, cityName: city }));
    } catch (err) {
      return fail(res, err);
    }
  });
  }, { prefix: "/api" });

  // Static front end, if this process is also serving it.
  if (WEB_ROOT && fs.existsSync(WEB_ROOT)) {
    await app.register(fastifyStatic, { root: path.resolve(WEB_ROOT) });

    // Single-page app: unmatched GETs return index.html so client-side routes
    // and refreshes work. Anything under /api that got here is a genuine 404
    // and must stay JSON — returning HTML would make fetch() parse garbage.
    app.setNotFoundHandler((req, res) => {
      if (req.url.startsWith("/api/") || req.method !== "GET") {
        return res.status(404).send({ code: "NOT_FOUND", error: "Not found" });
      }
      return res.sendFile("index.html");
    });
    app.log.info(`serving web app from ${path.resolve(WEB_ROOT)}`);
  }

  // Routes and plugins must all be registered before listen(): Fastify closes
  // registration once the server is ready.
  await app.listen({ port: PORT, host: HOST });
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
