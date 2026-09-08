import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    dailyPuzzle: { findUnique: vi.fn(), create: vi.fn() },
    city: { findMany: vi.fn() },
  },
}));
vi.mock("../src/db", () => ({ prisma }));

const { getOrCreateDailyPuzzle } = await import("../src/services/puzzle");

const POOL = [
  { id: 1, name: "Toronto", answerable: true },
  { id: 2, name: "Montréal", answerable: true },
  { id: 3, name: "Halifax", answerable: true },
];

const MARCH_10 = new Date("2026-03-10T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T15:30:00Z"));
  prisma.city.findMany.mockResolvedValue(POOL);
});
afterEach(() => vi.useRealTimers());

describe("getOrCreateDailyPuzzle", () => {
  it("returns today's puzzle when one already exists", async () => {
    const existing = { date: MARCH_10, cityId: 1, city: POOL[0] };
    prisma.dailyPuzzle.findUnique.mockResolvedValue(existing);

    expect(await getOrCreateDailyPuzzle()).toBe(existing);
    expect(prisma.dailyPuzzle.create).not.toHaveBeenCalled();
  });

  it("keys the puzzle on the UTC date, not the local one", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue({ date: MARCH_10, cityId: 1, city: POOL[0] });
    await getOrCreateDailyPuzzle();
    expect(prisma.dailyPuzzle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { date: MARCH_10 } }),
    );
  });

  it("rolls over at UTC midnight, not before", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue({ date: MARCH_10, cityId: 1, city: POOL[0] });

    vi.setSystemTime(new Date("2026-03-10T23:59:59Z"));
    await getOrCreateDailyPuzzle();
    expect(prisma.dailyPuzzle.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { date: new Date("2026-03-10T00:00:00Z") } }),
    );

    vi.setSystemTime(new Date("2026-03-11T00:00:01Z"));
    await getOrCreateDailyPuzzle();
    expect(prisma.dailyPuzzle.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { date: new Date("2026-03-11T00:00:00Z") } }),
    );
  });

  it("draws only from the answerable pool", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue(null);
    prisma.dailyPuzzle.create.mockImplementation(async ({ data }: any) => ({ ...data }));

    await getOrCreateDailyPuzzle();
    expect(prisma.city.findMany).toHaveBeenCalledWith({ where: { answerable: true } });
    const { cityId } = prisma.dailyPuzzle.create.mock.calls[0][0].data;
    expect(POOL.map((c) => c.id)).toContain(cityId);
  });

  it("stamps the new puzzle with today's UTC date", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue(null);
    prisma.dailyPuzzle.create.mockImplementation(async ({ data }: any) => ({ ...data }));

    await getOrCreateDailyPuzzle();
    expect(prisma.dailyPuzzle.create.mock.calls[0][0].data.date).toEqual(MARCH_10);
  });

  it("fails loudly when the answerable pool is empty", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue(null);
    prisma.city.findMany.mockResolvedValue([]);
    await expect(getOrCreateDailyPuzzle()).rejects.toThrow("No cities available");
  });

  it("gives every racing player the winner's city, not an error", async () => {
    // Two players arrive at UTC midnight, both miss the lookup, both insert the
    // same primary key. The loser must read back the winner's row.
    const winner = { date: MARCH_10, cityId: 2, city: POOL[1] };
    prisma.dailyPuzzle.findUnique
      .mockResolvedValueOnce(null)   // the initial miss
      .mockResolvedValueOnce(winner); // the read-back after the collision
    prisma.dailyPuzzle.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    expect(await getOrCreateDailyPuzzle()).toBe(winner);
  });

  it("rethrows a unique-violation it cannot resolve", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue(null);
    const dup = Object.assign(new Error("dup"), { code: "P2002" });
    prisma.dailyPuzzle.create.mockRejectedValue(dup);
    await expect(getOrCreateDailyPuzzle()).rejects.toBe(dup);
  });

  it("does not swallow errors other than the race", async () => {
    prisma.dailyPuzzle.findUnique.mockResolvedValue(null);
    const outage = Object.assign(new Error("connection refused"), { code: "P1001" });
    prisma.dailyPuzzle.create.mockRejectedValue(outage);
    await expect(getOrCreateDailyPuzzle()).rejects.toBe(outage);
  });
});
