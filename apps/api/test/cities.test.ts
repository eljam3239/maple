import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({ prisma: { city: { findMany: vi.fn() } } }));
vi.mock("../src/db", () => ({ prisma }));

const { listCities } = await import("../src/services/cities");

beforeEach(() => vi.clearAllMocks());

describe("listCities", () => {
  it("ships only the guessable pool, most populous first", async () => {
    prisma.city.findMany.mockResolvedValue([]);
    await listCities();

    expect(prisma.city.findMany).toHaveBeenCalledWith({
      where: { guessable: true },
      select: { id: true, name: true, province: true, aliases: true },
      orderBy: { population: "desc" },
    });
  });

  it("never selects the fields that would give the answer away", async () => {
    // Latitude, longitude and population are what the hints are derived from;
    // shipping them would let a client solve the puzzle offline.
    prisma.city.findMany.mockResolvedValue([]);
    await listCities();

    const { select } = prisma.city.findMany.mock.calls[0][0];
    expect(select).not.toHaveProperty("latitude");
    expect(select).not.toHaveProperty("longitude");
    expect(select).not.toHaveProperty("population");
    expect(select).not.toHaveProperty("answerable");
  });

  it("returns the rows as the autocomplete expects them", async () => {
    const rows = [{ id: 1, name: "Toronto", province: "Ontario", aliases: [] }];
    prisma.city.findMany.mockResolvedValue(rows);
    expect(await listCities()).toEqual(rows);
  });
});
