import { describe, expect, it } from "vitest";
import {
  busynessOf,
  getMatchState,
  phaseContextForAI,
  phaseOf,
  simMinuteNow,
} from "@/lib/matchPhase";

const CYCLE_EPOCH = Date.UTC(2025, 0, 1, 0, 0, 0);

describe("simMinuteNow", () => {
  it("returns 0 at the cycle epoch", () => {
    expect(simMinuteNow(CYCLE_EPOCH)).toBeCloseTo(0, 5);
  });

  it("advances 1.5 sim-minutes per real second", () => {
    expect(simMinuteNow(CYCLE_EPOCH + 10_000)).toBeCloseTo(15, 5);
  });

  it("wraps back to zero after a 120-real-second cycle", () => {
    expect(simMinuteNow(CYCLE_EPOCH + 120_000)).toBeCloseTo(0, 5);
  });

  it("stays within [0, 180) for inputs before the epoch", () => {
    const m = simMinuteNow(CYCLE_EPOCH - 5_000);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(180);
  });
});

describe("phaseOf boundaries", () => {
  it("maps each sim-minute range to the correct phase", () => {
    expect(phaseOf(0)).toBe("pre-match");
    expect(phaseOf(29.9)).toBe("pre-match");
    expect(phaseOf(30)).toBe("first-half");
    expect(phaseOf(74.9)).toBe("first-half");
    expect(phaseOf(75)).toBe("half-time");
    expect(phaseOf(89.9)).toBe("half-time");
    expect(phaseOf(90)).toBe("second-half");
    expect(phaseOf(134.9)).toBe("second-half");
    expect(phaseOf(135)).toBe("full-time");
    expect(phaseOf(139.9)).toBe("full-time");
    expect(phaseOf(140)).toBe("exiting");
    expect(phaseOf(169.9)).toBe("exiting");
    expect(phaseOf(170)).toBe("venue-clear");
  });
});

describe("busynessOf", () => {
  it("peaks at half-time and during exits", () => {
    expect(busynessOf("half-time")).toBe(3);
    expect(busynessOf("full-time")).toBe(3);
    expect(busynessOf("exiting")).toBe(3);
  });

  it("is lowest in-play and after the venue clears", () => {
    expect(busynessOf("first-half")).toBe(1);
    expect(busynessOf("second-half")).toBe(1);
    expect(busynessOf("venue-clear")).toBe(0);
  });
});

describe("getMatchState", () => {
  it("returns a consistent snapshot for a given instant", () => {
    // 40 real seconds past epoch → sim-minute 60 → first-half.
    const state = getMatchState(CYCLE_EPOCH + 40_000);
    expect(state.phase).toBe("first-half");
    expect(state.simMinute).toBeCloseTo(60, 5);
    expect(state.venueBusyness).toBe(1);
    expect(state.label).toBe("1st Half");
    expect(state.clock).toBe("30:00");
  });

  it("describes pre-match with a countdown", () => {
    const state = getMatchState(CYCLE_EPOCH + 10_000); // sim-minute 15
    expect(state.phase).toBe("pre-match");
    expect(state.clock).toMatch(/Kick-off in \d+ min/);
  });
});

describe("phaseContextForAI", () => {
  it("returns a non-empty sentence for every phase", () => {
    const phases = [
      "pre-match",
      "first-half",
      "half-time",
      "second-half",
      "full-time",
      "exiting",
      "venue-clear",
    ] as const;
    for (const phase of phases) {
      const text = phaseContextForAI({
        phase,
        label: "x",
        clock: "x",
        simMinute: 0,
        venueBusyness: 0,
      });
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
