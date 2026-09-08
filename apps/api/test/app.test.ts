import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { GameError } from "../src/errors";

const { prisma } = vi.hoisted(() => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("../src/db", () => ({ prisma }));

const { listCities, createPlayer, getOrCreateSession, evaluateGuess } = vi.hoisted(() => ({
  listCities: vi.fn(),
  createPlayer: vi.fn(),
  getOrCreateSession: vi.fn(),
  evaluateGuess: vi.fn(),
}));
vi.mock("../src/services/cities", () => ({ listCities }));
vi.mock("../src/services/session", () => ({ createPlayer, getOrCreateSession }));
vi.mock("../src/services/guess", () => ({ evaluateGuess }));

const { buildApp } = await import("../src/app");

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  listCities.mockResolvedValue([]);
  createPlayer.mockResolvedValue({ playerId: "p1" });
  getOrCreateSession.mockResolvedValue({ sessionId: "s1", guesses: [] });
  evaluateGuess.mockResolvedValue({ correct: false });
  app = await buildApp({ logger: false });
});

afterEach(async () => {
  await app.close();
});

describe("GET /api/health", () => {
  it("reports the API up and the database reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "maple-map API running", db: "ok" });
  });

  it("stays 200 when the database is down, so the host does not restart-loop", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().db).toBe("unreachable");
  });

  it("throttles the keep-alive query rather than running it every probe", async () => {
    // Fly probes every 30s; the database should be touched every 5 minutes.
    for (let i = 0; i < 5; i++) await app.inject({ method: "GET", url: "/api/health" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("re-checks once the throttle window has passed", async () => {
    vi.useFakeTimers();
    try {
      await app.inject({ method: "GET", url: "/api/health" });
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await app.inject({ method: "GET", url: "/api/health" });
    } finally {
      vi.useRealTimers();
    }
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/cities", () => {
  it("serves the guessable list", async () => {
    listCities.mockResolvedValue([{ id: 1, name: "Toronto", province: "Ontario", aliases: [] }]);
    const res = await app.inject({ method: "GET", url: "/api/cities" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe("POST /api/session", () => {
  it("rejects a request with no playerId", async () => {
    const res = await app.inject({ method: "POST", url: "/api/session", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_FIELDS");
    expect(getOrCreateSession).not.toHaveBeenCalled();
  });

  it("passes the playerId through to the service", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/session", payload: { playerId: "p1" },
    });
    expect(res.statusCode).toBe(200);
    expect(getOrCreateSession).toHaveBeenCalledWith("p1");
  });
});

describe("POST /api/guess", () => {
  it("rejects a request with neither a city id nor a name", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/guess", payload: { sessionId: "s1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_FIELDS");
    expect(evaluateGuess).not.toHaveBeenCalled();
  });

  it("rejects a request with no session", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/guess", payload: { cityId: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_FIELDS");
  });

  it("accepts a guess by id and one by name", async () => {
    await app.inject({ method: "POST", url: "/api/guess", payload: { sessionId: "s1", cityId: 7 } });
    expect(evaluateGuess).toHaveBeenCalledWith("s1", { cityId: 7, cityName: undefined });

    await app.inject({ method: "POST", url: "/api/guess", payload: { sessionId: "s1", city: "Barrie" } });
    expect(evaluateGuess).toHaveBeenCalledWith("s1", { cityId: undefined, cityName: "Barrie" });
  });
});

describe("error handling", () => {
  it("turns a GameError into a 400 carrying its code", async () => {
    evaluateGuess.mockRejectedValue(new GameError("SESSION_COMPLETED", "Session already completed"));
    const res = await app.inject({
      method: "POST", url: "/api/guess", payload: { sessionId: "s1", cityId: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ code: "SESSION_COMPLETED", error: "Session already completed" });
  });

  it("does not leak internal failures to the client", async () => {
    // A Prisma or connection error names tables, hosts and credentials.
    evaluateGuess.mockRejectedValue(
      new Error('relation "City" does not exist at postgres://maple_app:hunter2@db.internal'),
    );
    const res = await app.inject({
      method: "POST", url: "/api/guess", payload: { sessionId: "s1", cityId: 1 },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: "INTERNAL", error: "Something went wrong" });
    expect(res.body).not.toContain("postgres://");
    expect(res.body).not.toContain("hunter2");
  });

  it("keeps the same shape for a failure in any route", async () => {
    listCities.mockRejectedValue(new Error("pool exhausted"));
    const res = await app.inject({ method: "GET", url: "/api/cities" });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe("INTERNAL");
  });
});

describe("rate limiting", () => {
  it("caps player creation, which is the one route that grows the database", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({ method: "POST", url: "/api/player", payload: {} });
      codes.push(res.statusCode);
    }
    expect(codes.filter((c) => c === 200)).toHaveLength(5);
    expect(codes.filter((c) => c === 429)).toHaveLength(2);
  });

  it("keys the limit on the forwarded client address, not the load balancer", async () => {
    const hit = (ip: string) =>
      app.inject({
        method: "POST", url: "/api/player", payload: {},
        headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
      });

    for (let i = 0; i < 5; i++) await hit("203.0.113.7");
    expect((await hit("203.0.113.7")).statusCode).toBe(429);
    // A different player behind the same proxy must not be caught by it.
    expect((await hit("198.51.100.4")).statusCode).toBe(200);
  });
});

describe("serving the web app on the same origin", () => {
  let webRoot: string;
  let served: FastifyInstance;

  beforeEach(async () => {
    webRoot = fs.mkdtempSync(path.join(os.tmpdir(), "maple-web-"));
    fs.writeFileSync(path.join(webRoot, "index.html"), "<!doctype html><title>Maple</title>");
    served = await buildApp({ logger: false, webRoot });
  });

  afterEach(async () => {
    await served.close();
    fs.rmSync(webRoot, { recursive: true, force: true });
  });

  it("returns index.html for a client-side route", async () => {
    const res = await served.inject({ method: "GET", url: "/some/deep/link" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>Maple</title>");
  });

  it("keeps unmatched API routes as JSON, so fetch() does not parse HTML", async () => {
    const res = await served.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: "NOT_FOUND", error: "Not found" });
  });

  it("does not serve the SPA for a non-GET request", async () => {
    const res = await served.inject({ method: "POST", url: "/some/deep/link", payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("still serves the API when it is also serving the front end", async () => {
    const res = await served.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
  });
});
