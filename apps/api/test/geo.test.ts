import { describe, expect, it } from "vitest";
import { distanceKm, getDirection } from "../src/utils/geo";

// Reference coordinates, as GeoNames has them.
const TORONTO = [43.70011, -79.4163] as const;
const MONTREAL = [45.50884, -73.58781] as const;
const VANCOUVER = [49.24966, -123.11934] as const;
const HALIFAX = [44.6464, -63.57291] as const;
const CALGARY = [51.05011, -114.08529] as const;
const EDMONTON = [53.55014, -113.46871] as const;

const between = (a: readonly [number, number], b: readonly [number, number]) =>
  distanceKm(a[0], a[1], b[0], b[1]);
const heading = (a: readonly [number, number], b: readonly [number, number]) =>
  getDirection(a[0], a[1], b[0], b[1]);

describe("distanceKm", () => {
  it("is zero for a city against itself", () => {
    expect(between(TORONTO, TORONTO)).toBe(0);
  });

  it("matches known great-circle distances", () => {
    // Published values: Toronto-Montreal ~504 km, Vancouver-Halifax ~4,440 km,
    // Calgary-Edmonton ~280 km. Allow a couple of km for the spherical model.
    expect(between(TORONTO, MONTREAL)).toBeCloseTo(504, -1);
    expect(between(VANCOUVER, HALIFAX)).toBeCloseTo(4440, -2);
    expect(between(CALGARY, EDMONTON)).toBeCloseTo(280, -1);
  });

  it("is symmetric", () => {
    expect(between(TORONTO, VANCOUVER)).toBe(between(VANCOUVER, TORONTO));
    expect(between(HALIFAX, CALGARY)).toBe(between(CALGARY, HALIFAX));
  });

  it("returns whole kilometres", () => {
    const d = between(TORONTO, MONTREAL);
    expect(Number.isInteger(d)).toBe(true);
  });

  it("handles antimeridian-free longitude spans without sign errors", () => {
    // Same latitude, 10 degrees apart: the two directions must agree.
    expect(distanceKm(45, -80, 45, -70)).toBe(distanceKm(45, -70, 45, -80));
    expect(distanceKm(45, -80, 45, -70)).toBeGreaterThan(700);
  });

  it("grows with separation", () => {
    expect(between(TORONTO, MONTREAL)).toBeLessThan(between(TORONTO, HALIFAX));
    expect(between(TORONTO, HALIFAX)).toBeLessThan(between(TORONTO, VANCOUVER));
  });
});

describe("getDirection", () => {
  it("reads the four cardinals off the compass", () => {
    expect(getDirection(45, -80, 45, -70)).toBe("E");
    expect(getDirection(45, -70, 45, -80)).toBe("W");
    expect(getDirection(40, -80, 50, -80)).toBe("N");
    expect(getDirection(50, -80, 40, -80)).toBe("S");
  });

  it("reads the four diagonals", () => {
    expect(getDirection(45, -80, 50, -75)).toBe("NE");
    expect(getDirection(50, -75, 45, -80)).toBe("SW");
    expect(getDirection(50, -80, 45, -75)).toBe("SE");
    expect(getDirection(45, -75, 50, -80)).toBe("NW");
  });

  it("wraps negative angles instead of indexing off the end of the compass", () => {
    // Due west is -90 degrees, which lands on index -2 before the & 7 wrap.
    // A regression here returns undefined rather than a direction.
    for (const lon of [-70, -75, -79]) {
      expect(getDirection(45, lon, 45, -80)).toBeTypeOf("string");
    }
    expect(getDirection(50, -70, 40, -70)).toBe("S"); // 180 degrees exactly
  });

  it("is reversible: the way back is the opposite way", () => {
    const opposite: Record<string, string> = {
      N: "S", S: "N", E: "W", W: "E", NE: "SW", SW: "NE", NW: "SE", SE: "NW",
    };
    const pairs = [
      [TORONTO, MONTREAL], [VANCOUVER, HALIFAX], [CALGARY, EDMONTON],
    ] as const;
    for (const [a, b] of pairs) {
      expect(heading(b, a)).toBe(opposite[heading(a, b)]);
    }
  });

  it("only ever returns one of the eight compass points", () => {
    const valid = new Set(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    for (let lat = -80; lat <= 80; lat += 7) {
      for (let lon = -175; lon <= 175; lon += 11) {
        expect(valid.has(getDirection(45, -80, lat, lon))).toBe(true);
      }
    }
  });
});
