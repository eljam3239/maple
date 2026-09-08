import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    player: { findUnique: vi.fn(), create: vi.fn() },
    gameSession: { findUnique: vi.fn(), create: vi.fn() },
    city: { findUnique: vi.fn() },
  },
}));
vi.mock("../src/db", () => ({ prisma }));

const STATS = {
  currentStreak: 0, maxStreak: 0, gamesPlayed: 0,
  wins: 0, winPct: 0, avgGuesses: 0, lastWin: null,
};
vi.mock("../src/services/stats", () => ({ computeStats: vi.fn(async () => STATS) }));

const PUZZLE_DATE = new Date("2026-03-10T00:00:00Z");
const { getOrCreateDailyPuzzle } = vi.hoisted(() => ({ getOrCreateDailyPuzzle: vi.fn() }));
vi.mock("../src/services/puzzle", () => ({ getOrCreateDailyPuzzle }));

const { createPlayer, getOrCreateSession } = await import("../src/services/session");

const TORONTO = {
  id: 1, name: "Toronto", province: "Ontario",
  latitude: 43.70011, longitude: -79.4163, population: 2_600_000,
};
const HALIFAX = {
  id: 3, name: "Halifax", province: "Nova Scotia",
  latitude: 44.6464, longitude: -63.57291, population: 400_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  getOrCreateDailyPuzzle.mockResolvedValue({ date: PUZZLE_DATE, cityId: TORONTO.id, city: TORONTO });
  prisma.player.findUnique.mockResolvedValue({ id: "p1" });
  prisma.city.findUnique.mockResolvedValue(TORONTO);
});

describe("createPlayer", () => {
  it("hands back the id of a freshly created player", async () => {
    prisma.player.create.mockResolvedValue({ id: "new-player" });
    expect(await createPlayer()).toEqual({ playerId: "new-player" });
  });
});

describe("getOrCreateSession — a first visit", () => {
  it("opens a session on today's puzzle with no guesses yet", async () => {
    prisma.gameSession.findUnique.mockResolvedValue(null);
    prisma.gameSession.create.mockResolvedValue({ id: "s1", puzzleDate: PUZZLE_DATE });

    const res = await getOrCreateSession("p1");

    expect(prisma.gameSession.create).toHaveBeenCalledWith({
      data: { playerId: "p1", puzzleDate: PUZZLE_DATE, targetCityId: TORONTO.id },
    });
    expect(res).toMatchObject({ sessionId: "s1", completed: false, won: false, guesses: [] });
    expect(res.answer).toBeUndefined();
  });

  it("registers a player it has never seen before", async () => {
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.gameSession.findUnique.mockResolvedValue(null);
    prisma.gameSession.create.mockResolvedValue({ id: "s1", puzzleDate: PUZZLE_DATE });

    await getOrCreateSession("returning-from-localstorage");

    expect(prisma.player.create).toHaveBeenCalledWith({
      data: { id: "returning-from-localstorage" },
    });
  });

  it("does not re-create a player it already knows", async () => {
    prisma.gameSession.findUnique.mockResolvedValue(null);
    prisma.gameSession.create.mockResolvedValue({ id: "s1", puzzleDate: PUZZLE_DATE });

    await getOrCreateSession("p1");

    expect(prisma.player.create).not.toHaveBeenCalled();
  });
});

describe("getOrCreateSession — resuming", () => {
  const guessRow = (city: typeof TORONTO, correct: boolean) => ({
    correct,
    distanceKm: 1276,
    direction: "W",
    city,
  });

  function resuming(opts: { completed: boolean; guesses: ReturnType<typeof guessRow>[] }) {
    prisma.gameSession.findUnique.mockResolvedValue({
      id: "s1",
      puzzleDate: PUZZLE_DATE,
      targetCityId: TORONTO.id,
      completed: opts.completed,
      guesses: opts.guesses,
    });
  }

  it("returns the same session rather than starting a second one", async () => {
    resuming({ completed: false, guesses: [guessRow(HALIFAX, false)] });

    const res = await getOrCreateSession("p1");

    expect(prisma.gameSession.create).not.toHaveBeenCalled();
    expect(res.sessionId).toBe("s1");
    expect(prisma.gameSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId_puzzleDate: { playerId: "p1", puzzleDate: PUZZLE_DATE } },
      }),
    );
  });

  it("replays each past guess with its hints recomputed", async () => {
    resuming({ completed: false, guesses: [guessRow(HALIFAX, false)] });

    const [replayed] = (await getOrCreateSession("p1")).guesses;

    expect(replayed).toMatchObject({
      city: "Halifax",
      correct: false,
      province: "Nova Scotia",
      provinceMatch: false,
      provinceDistance: 3,
      populationHint: "larger", // Toronto is bigger than Halifax
    });
  });

  it("does not leak the answer into a game still in progress", async () => {
    resuming({ completed: false, guesses: [guessRow(HALIFAX, false)] });

    const res = await getOrCreateSession("p1");

    expect(res.completed).toBe(false);
    expect(res.answer).toBeUndefined();
    expect(JSON.stringify(res)).not.toContain("Toronto");
  });

  it("reveals the answer once the game is over", async () => {
    resuming({ completed: true, guesses: [guessRow(HALIFAX, false), guessRow(TORONTO, true)] });

    const res = await getOrCreateSession("p1");

    expect(res.won).toBe(true);
    expect(res.answer).toEqual({
      name: "Toronto", province: "Ontario",
      latitude: TORONTO.latitude, longitude: TORONTO.longitude,
    });
  });

  it("reports a finished game with no correct guess as a loss", async () => {
    resuming({ completed: true, guesses: [guessRow(HALIFAX, false)] });

    const res = await getOrCreateSession("p1");

    expect(res.completed).toBe(true);
    expect(res.won).toBe(false);
    expect(res.answer?.name).toBe("Toronto");
  });
});
