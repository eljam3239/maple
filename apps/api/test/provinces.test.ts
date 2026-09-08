import { describe, expect, it } from "vitest";
import { computeProvinceDistance } from "../src/utils/provinces";

const PROVINCES = [
  "British Columbia", "Alberta", "Saskatchewan", "Manitoba", "Ontario",
  "Quebec", "New Brunswick", "Nova Scotia", "Prince Edward Island",
  "Newfoundland and Labrador", "Yukon", "Northwest Territories", "Nunavut",
];

const UNREACHABLE = 99;

describe("computeProvinceDistance", () => {
  it("is zero within a province", () => {
    for (const p of PROVINCES) expect(computeProvinceDistance(p, p)).toBe(0);
  });

  it("is one between neighbours", () => {
    expect(computeProvinceDistance("Ontario", "Quebec")).toBe(1);
    expect(computeProvinceDistance("Alberta", "British Columbia")).toBe(1);
    expect(computeProvinceDistance("Nova Scotia", "Prince Edward Island")).toBe(1);
    expect(computeProvinceDistance("Yukon", "Northwest Territories")).toBe(1);
  });

  it("counts hops across the country", () => {
    // BC -> NWT -> Manitoba -> Ontario.
    expect(computeProvinceDistance("British Columbia", "Ontario")).toBe(3);
    // BC -> AB -> SK.
    expect(computeProvinceDistance("British Columbia", "Saskatchewan")).toBe(2);
    // Yukon to the far east, the longest span on the board.
    expect(computeProvinceDistance("Yukon", "Prince Edward Island")).toBeGreaterThan(3);
  });

  it("is symmetric for every pair", () => {
    for (const a of PROVINCES) {
      for (const b of PROVINCES) {
        expect(
          computeProvinceDistance(a, b),
          `${a} -> ${b} disagrees with the reverse`,
        ).toBe(computeProvinceDistance(b, a));
      }
    }
  });

  it("connects every province to every other one", () => {
    // A province missing from the adjacency map — or listed with a typo —
    // would strand it at 99 and quietly break the map colouring.
    for (const a of PROVINCES) {
      for (const b of PROVINCES) {
        expect(computeProvinceDistance(a, b), `${a} -> ${b}`).toBeLessThan(UNREACHABLE);
      }
    }
  });

  it("obeys the triangle inequality", () => {
    for (const a of PROVINCES) {
      for (const b of PROVINCES) {
        for (const c of PROVINCES) {
          expect(computeProvinceDistance(a, c)).toBeLessThanOrEqual(
            computeProvinceDistance(a, b) + computeProvinceDistance(b, c),
          );
        }
      }
    }
  });

  it("reports an unknown province as unreachable rather than throwing", () => {
    expect(computeProvinceDistance("Ontario", "Atlantis")).toBe(UNREACHABLE);
    expect(computeProvinceDistance("Atlantis", "Ontario")).toBe(UNREACHABLE);
    expect(computeProvinceDistance("", "Ontario")).toBe(UNREACHABLE);
  });
});
