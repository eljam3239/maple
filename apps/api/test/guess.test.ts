import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_GUESSES } from "@maple/types";
import { GameError } from "../src/errors";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    gameSession: { findUnique: vi.fn(), update: vi.fn() },
    guess: { count: vi.fn(), create: vi.fn() },
    city: { findFirst: vi.fn(), findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("../src/db", () => ({ prisma }));

const EMPTY_STATS = {
  currentStreak: 1, maxStreak: 1, gamesPlayed: 1,
  wins: 1, winPct: 100, avgGuesses: 1, lastWin: "2026-03-10",
};
vi.mock("../src/services/stats", () => ({
  computeStats: vi.fn(async () => EMPTY_STATS),
}));

const { evaluateGuess } = await import("../src/services/guess");

const TORONTO = {
  id: 1, name: "Toronto", province: "Ontario",
  latitude: 43.70011, longitude: -79.4163, population: 2_600_000, guessable: true,
};
const MONTREAL = {
  id: 2, name: "Montréal", province: "Quebec",
  latitude: 45.50884, longitude: -73.58781, population: 1_600_000, guessable: true,
};
const HALIFAX = {
  id: 3, name: "Halifax", province: "Nova Scotia",
  latitude: 44.6464, longitude: -63.57291, population: 400_000, guessable: true,
};

/** Wire the mocks up for one round: an open session whose answer is `target`. */
function arrange(opts: {
  target: typeof TORONTO;
  guessed: typeof TORONTO | null;
  priorGuesses?: number;
  completed?: boolean;
  sessionExists?: boolean;
}) {
  const { target, guessed, priorGuesses = 0, completed = false, sessionExists = true } = opts;
  prisma.gameSession.findUnique.mockResolvedValue(
    sessionExists
      ? { id: "s1", playerId: "p1", targetCityId: target.id, completed }
      : null,
  );
  prisma.guess.count.mockResolvedValue(priorGuesses);
  prisma.city.findFirst.mockResolvedValue(guessed);
  prisma.city.findUnique.mockResolvedValue(target);
  prisma.guess.create.mockResolvedValue({});
  prisma.gameSession.update.mockResolvedValue({});
  prisma.$queryRaw.mockResolvedValue([]);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("evaluateGuess — rejections", () => {
  it("rejects an unknown session", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, sessionExists: false });
    await expect(evaluateGuess("nope", { cityId: 2 })).rejects.toThrow(
      expect.objectContaining({ code: "SESSION_NOT_FOUND" }),
    );
  });

  it("rejects a guess against a finished session", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, completed: true });
    await expect(evaluateGuess("s1", { cityId: 2 })).rejects.toMatchObject({
      code: "SESSION_COMPLETED",
    });
  });

  it("rejects a guess once the budget is spent", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, priorGuesses: MAX_GUESSES });
    await expect(evaluateGuess("s1", { cityId: 2 })).rejects.toMatchObject({
      code: "NO_GUESSES_REMAINING",
    });
    expect(prisma.guess.create).not.toHaveBeenCalled();
  });

  it("rejects a city that is not in the guessable pool", async () => {
    arrange({ target: TORONTO, guessed: null });
    await expect(evaluateGuess("s1", { cityId: 999 })).rejects.toMatchObject({
      code: "CITY_NOT_FOUND",
    });
  });

  it("throws a GameError, not a bare Error, for player-facing rejections", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, completed: true });
    await expect(evaluateGuess("s1", { cityId: 2 })).rejects.toBeInstanceOf(GameError);
  });

  it("records nothing when the guess is rejected", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, sessionExists: false });
    await expect(evaluateGuess("s1", { cityId: 2 })).rejects.toThrow();
    expect(prisma.guess.create).not.toHaveBeenCalled();
    expect(prisma.gameSession.update).not.toHaveBeenCalled();
  });
});

describe("evaluateGuess — hints", () => {
  it("reports distance and direction to the target", async () => {
    arrange({ target: MONTREAL, guessed: TORONTO });
    const res = await evaluateGuess("s1", { cityId: 1 });
    expect(res.correct).toBe(false);
    expect(res.city).toBe("Toronto");
    expect(res.distanceKm).toBeCloseTo(504, -1);
    expect(res.direction).toBe("E");
  });

  it("says the target is larger when the guess is smaller", async () => {
    arrange({ target: TORONTO, guessed: HALIFAX });
    const res = await evaluateGuess("s1", { cityId: 3 });
    expect(res.populationHint).toBe("larger");
  });

  it("says the target is smaller when the guess is bigger", async () => {
    arrange({ target: HALIFAX, guessed: TORONTO });
    const res = await evaluateGuess("s1", { cityId: 1 });
    expect(res.populationHint).toBe("smaller");
  });

  it("says equal when the populations tie", async () => {
    const twin = { ...HALIFAX, id: 4, name: "Twin", population: TORONTO.population };
    arrange({ target: TORONTO, guessed: twin });
    const res = await evaluateGuess("s1", { cityId: 4 });
    expect(res.populationHint).toBe("equal");
  });

  it("reports province match and how many provinces away", async () => {
    arrange({ target: MONTREAL, guessed: TORONTO });
    const ontarioGuess = await evaluateGuess("s1", { cityId: 1 });
    expect(ontarioGuess.provinceMatch).toBe(false);
    expect(ontarioGuess.province).toBe("Ontario");
    expect(ontarioGuess.provinceDistance).toBe(1);

    arrange({ target: { ...MONTREAL, id: 9 }, guessed: MONTREAL });
    const sameProvince = await evaluateGuess("s1", { cityId: 2 });
    expect(sameProvince.provinceMatch).toBe(true);
    expect(sameProvince.provinceDistance).toBe(0);
  });

  it("counts down the remaining guesses", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, priorGuesses: 4 });
    const res = await evaluateGuess("s1", { cityId: 2 });
    expect(res.guessesRemaining).toBe(MAX_GUESSES - 5);
  });
});

describe("evaluateGuess — keeping the answer secret", () => {
  it("does not reveal the target while the game is still on", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, priorGuesses: 0 });
    const res = await evaluateGuess("s1", { cityId: 2 });
    expect(res.gameOver).toBe(false);
    expect(res.answer).toBeUndefined();
    // Nor by any other route: the whole payload must not name the target.
    expect(JSON.stringify(res)).not.toContain("Toronto");
  });

  it("reveals the target on a correct guess", async () => {
    arrange({ target: TORONTO, guessed: TORONTO });
    const res = await evaluateGuess("s1", { cityId: 1 });
    expect(res.correct).toBe(true);
    expect(res.won).toBe(true);
    expect(res.gameOver).toBe(true);
    expect(res.answer).toEqual({
      name: "Toronto", province: "Ontario",
      latitude: TORONTO.latitude, longitude: TORONTO.longitude,
    });
  });

  it("reveals the target when the last guess is spent", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, priorGuesses: MAX_GUESSES - 1 });
    const res = await evaluateGuess("s1", { cityId: 2 });
    expect(res.gameOver).toBe(true);
    expect(res.won).toBe(false);
    expect(res.guessesRemaining).toBe(0);
    expect(res.answer?.name).toBe("Toronto");
  });

  it("keeps the answer hidden on the second-to-last guess", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL, priorGuesses: MAX_GUESSES - 2 });
    const res = await evaluateGuess("s1", { cityId: 2 });
    expect(res.gameOver).toBe(false);
    expect(res.guessesRemaining).toBe(1);
    expect(res.answer).toBeUndefined();
  });
});

describe("evaluateGuess — persistence", () => {
  it("records the guess with its derived hints", async () => {
    arrange({ target: MONTREAL, guessed: TORONTO });
    await evaluateGuess("s1", { cityId: 1 });
    expect(prisma.guess.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "s1", cityId: 1, correct: false, direction: "E",
      }),
    });
  });

  it("closes the session and returns stats when the game ends", async () => {
    arrange({ target: TORONTO, guessed: TORONTO });
    const res = await evaluateGuess("s1", { cityId: 1 });
    expect(prisma.gameSession.update).toHaveBeenCalledWith({
      where: { id: "s1" }, data: { completed: true },
    });
    expect(res.stats).toEqual(EMPTY_STATS);
  });

  it("leaves the session open and withholds stats mid-game", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL });
    const res = await evaluateGuess("s1", { cityId: 2 });
    expect(prisma.gameSession.update).not.toHaveBeenCalled();
    expect(res.stats).toBeUndefined();
  });
});

describe("evaluateGuess — resolving which city was guessed", () => {
  it("looks the city up by id, restricted to the guessable pool", async () => {
    arrange({ target: MONTREAL, guessed: TORONTO });
    await evaluateGuess("s1", { cityId: 1 });
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { id: 1, guessable: true },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("falls back to a name lookup when no id is given", async () => {
    arrange({ target: TORONTO, guessed: MONTREAL });
    prisma.$queryRaw.mockResolvedValue([{ id: 2 }]);
    const res = await evaluateGuess("s1", { cityName: "montreal" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { id: 2, guessable: true },
    });
    expect(res.city).toBe("Montréal");
  });

  it("prefers the id when both an id and a name arrive", async () => {
    arrange({ target: MONTREAL, guessed: TORONTO });
    await evaluateGuess("s1", { cityId: 1, cityName: "somewhere else" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a typed name that matches nothing", async () => {
    arrange({ target: TORONTO, guessed: null });
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(evaluateGuess("s1", { cityName: "Narnia" })).rejects.toMatchObject({
      code: "CITY_NOT_FOUND",
    });
  });
});
