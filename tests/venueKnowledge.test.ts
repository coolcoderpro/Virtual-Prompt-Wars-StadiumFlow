import { describe, expect, it } from "vitest";
import { POI_META, VENUE_SYSTEM_PROMPT, poisForSection } from "@/lib/venueKnowledge";

describe("poisForSection", () => {
  it("returns every POI that serves a given section", () => {
    const north = poisForSection("north-lower");
    expect(north).toContain("gate-a");
    expect(north).toContain("wc-n1");
    expect(north).toContain("wc-n2");
    expect(north).toContain("food-n");
  });

  it("returns an empty array for an unknown section", () => {
    expect(poisForSection("does-not-exist")).toEqual([]);
  });

  it("includes POIs that serve multi-section areas", () => {
    const club = poisForSection("club-wembley");
    expect(club).toContain("gate-d");
    expect(club).toContain("wc-w1");
    expect(club).toContain("food-w");
  });
});

describe("POI_META integrity", () => {
  it("flags gate-a and gate-c as accessible, gate-b as not", () => {
    expect(POI_META["gate-a"].accessible).toBe(true);
    expect(POI_META["gate-b"].accessible).toBe(false);
    expect(POI_META["gate-c"].accessible).toBe(true);
  });

  it("gives every concession a features list", () => {
    const concessionIds = ["food-n", "food-s", "food-e", "food-w"];
    for (const id of concessionIds) {
      expect(POI_META[id].features?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("VENUE_SYSTEM_PROMPT", () => {
  it("mentions the core safety rule for first aid", () => {
    expect(VENUE_SYSTEM_PROMPT.toLowerCase()).toContain("first aid");
    expect(VENUE_SYSTEM_PROMPT.toLowerCase()).toContain("steward");
  });

  it("instructs the model to be concise", () => {
    expect(VENUE_SYSTEM_PROMPT.toLowerCase()).toMatch(/concise|short/);
  });
});
