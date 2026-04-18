import { describe, expect, it } from "vitest";
import { distanceMeters, suggest } from "@/lib/suggest";
import type { Poi } from "@/lib/types";

const ORIGIN = { lat: 51.5560, lng: -0.2795 };

const POIS: Poi[] = [
  {
    id: "close-packed",
    name: "Close but packed",
    type: "restroom",
    location: { lat: 51.5561, lng: -0.2795 },
    crowdLevel: 3,
    waitMinutes: 10,
    updatedAt: 0,
  },
  {
    id: "far-clear",
    name: "Far but clear",
    type: "restroom",
    location: { lat: 51.5570, lng: -0.2795 },
    crowdLevel: 0,
    waitMinutes: 0,
    updatedAt: 0,
  },
  {
    id: "wrong-type",
    name: "Concession",
    type: "concession",
    location: { lat: 51.5561, lng: -0.2795 },
    crowdLevel: 0,
    waitMinutes: 0,
    updatedAt: 0,
  },
];

describe("distanceMeters", () => {
  it("returns 0 for identical points", () => {
    expect(distanceMeters(ORIGIN, ORIGIN)).toBeCloseTo(0, 3);
  });

  it("returns a positive distance for different points", () => {
    expect(distanceMeters(ORIGIN, { lat: 51.5570, lng: -0.2795 })).toBeGreaterThan(
      50
    );
  });
});

describe("suggest", () => {
  it("filters by POI type", () => {
    const result = suggest(POIS, ORIGIN, "restroom");
    expect(result.every((r) => r.type === "restroom")).toBe(true);
    expect(result.length).toBe(2);
  });

  it("prefers a further but clearer option over a close packed one", () => {
    const result = suggest(POIS, ORIGIN, "restroom");
    expect(result[0]?.id).toBe("far-clear");
  });

  it("returns scores and distances on each result", () => {
    const [top] = suggest(POIS, ORIGIN, "restroom");
    expect(top).toBeDefined();
    expect(typeof top!.score).toBe("number");
    expect(typeof top!.distance).toBe("number");
  });

  it("returns empty array when no POIs match the type", () => {
    expect(suggest(POIS, ORIGIN, "firstaid")).toEqual([]);
  });
});
