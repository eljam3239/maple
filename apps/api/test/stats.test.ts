import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { gameSession: { findMany: vi.fn() } },
}));
vi.mock("../src/db", () => ({ prisma }));

const { computeStats } = await import("../src/services/stats");

// A finished session on `date` with `guesses` attempts, the last of which was
// the winner when `won`.
function session(date: string, opts: { won: boolean; guesses?: number; completed?: boolean }) {
  const guesses = opts.guesses ?? 1;
  return {
    puzzleDate: new Date(`${date}T00:00:00Z`),
    completed: opts.completed ?? true,
    guesses: Array.from({ length: guesses }, (_, i) => ({
      correct: opts.won && i === guesses - 1,
    })),
  };
}

const statsFor = (sessions: unknown[]) => {
  prisma.gameSession.findMany.mockResolvedValue(sessions);
  return computeStats("player-1");
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("computeStats", () => {
  it("returns an empty scorecard for a player who has never finished a game", async () => {
    expect(await statsFor([])).toEqual({
      currentStreak: 0, maxStreak: 0, gamesPlayed: 0,
      wins: 0, winPct: 0, avgGuesses: 0, lastWin: null,
    });
  });

  it("ignores games still in progress", async () => {
    const stats = await statsFor([
      session("2026-03-10", { won: false, completed: false, guesses: 4 }),
    ]);
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.winPct).toBe(0);
  });

  it("counts a finished loss as played but not won", async () => {
    const stats = await statsFor([
      session("2026-03-09", { won: false, guesses: 13 }),
      session("2026-03-10", { won: true, guesses: 3 }),
    ]);
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.winPct).toBe(50);
  });

  it("averages guesses over won games only", async () => {
    // 2 + 5 guesses to win, plus a 13-guess loss that must not drag it up.
    const stats = await statsFor([
      session("2026-03-08", { won: true, guesses: 2 }),
      session("2026-03-09", { won: true, guesses: 5 }),
      session("2026-03-10", { won: false, guesses: 13 }),
    ]);
    expect(stats.avgGuesses).toBe(3.5);
  });

  it("rounds the average to one decimal", async () => {
    const stats = await statsFor([
      session("2026-03-08", { won: true, guesses: 1 }),
      session("2026-03-09", { won: true, guesses: 2 }),
      session("2026-03-10", { won: true, guesses: 2 }),
    ]);
    expect(stats.avgGuesses).toBe(1.7);
  });

  it("counts a streak that runs up to today", async () => {
    const stats = await statsFor([
      session("2026-03-08", { won: true }),
      session("2026-03-09", { won: true }),
      session("2026-03-10", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(3);
    expect(stats.lastWin).toBe("2026-03-10");
  });

  it("keeps the streak alive when today has not been played yet", async () => {
    // A player who won yesterday still has their streak at midday today.
    const stats = await statsFor([
      session("2026-03-08", { won: true }),
      session("2026-03-09", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(2);
  });

  it("drops the streak once a day is missed", async () => {
    // Won through the 7th, missed the 8th and 9th, nothing today.
    const stats = await statsFor([
      session("2026-03-06", { won: true }),
      session("2026-03-07", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(0);
    expect(stats.lastWin).toBe("2026-03-07");
  });

  it("breaks the streak on a loss, not just on an absent day", async () => {
    const stats = await statsFor([
      session("2026-03-08", { won: true }),
      session("2026-03-09", { won: false, guesses: 13 }),
      session("2026-03-10", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(1);
  });

  it("remembers the longest run ever, even after it ends", async () => {
    const stats = await statsFor([
      session("2026-02-01", { won: true }),
      session("2026-02-02", { won: true }),
      session("2026-02-03", { won: true }),
      session("2026-02-04", { won: true }),
      // gap
      session("2026-03-09", { won: true }),
      session("2026-03-10", { won: true }),
    ]);
    expect(stats.maxStreak).toBe(4);
    expect(stats.currentStreak).toBe(2);
  });

  it("counts a streak across a month boundary", async () => {
    vi.setSystemTime(new Date("2026-03-01T09:00:00Z"));
    const stats = await statsFor([
      session("2026-02-27", { won: true }),
      session("2026-02-28", { won: true }),
      session("2026-03-01", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(3);
  });

  it("does not double-count a day, however the rows arrive", async () => {
    const stats = await statsFor([
      session("2026-03-10", { won: true }),
      session("2026-03-10", { won: true }),
    ]);
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(1);
  });

  it("scopes the query to the player it was asked about", async () => {
    await statsFor([]);
    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: "player-1" } }),
    );
  });
});
