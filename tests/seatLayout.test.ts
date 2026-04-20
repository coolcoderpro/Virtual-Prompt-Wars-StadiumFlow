/**
 * Unit tests for seat-layout geometry.
 *
 * `resolveSeatLocation` drives the "you are here" marker and distance
 * calculations for chat suggestions. Getting row/seat → lat/lng wrong
 * would mis-route fans, so the fallback logic (partial row/seat info)
 * matters.
 */

import { describe, expect, it } from "vitest";
import {
  SECTION_LAYOUTS,
  getLayout,
  parseSeatNumber,
  resolveSeatLocation,
} from "@/lib/seatLayout";

describe("parseSeatNumber", () => {
  it("extracts the leading integer", () => {
    expect(parseSeatNumber("12")).toBe(12);
    expect(parseSeatNumber("12a")).toBe(12);
    expect(parseSeatNumber("  7 ")).toBe(7);
  });

  it("returns null for empty, negative, or non-numeric input", () => {
    expect(parseSeatNumber(undefined)).toBeNull();
    expect(parseSeatNumber("")).toBeNull();
    expect(parseSeatNumber("abc")).toBeNull();
    expect(parseSeatNumber("0")).toBeNull();
  });
});

describe("getLayout", () => {
  it("returns the configured layout for known sections", () => {
    const layout = getLayout("north-lower");
    expect(layout).not.toBeNull();
    expect(layout!.rows[0]).toBe("A");
  });

  it("returns null for unknown sections", () => {
    expect(getLayout("nope")).toBeNull();
  });
});

describe("resolveSeatLocation", () => {
  it("returns null when the section has no layout", () => {
    expect(resolveSeatLocation("nope", "A", "1")).toBeNull();
  });

  it("returns null when both row and seat are missing", () => {
    expect(resolveSeatLocation("north-lower", undefined, undefined)).toBeNull();
  });

  it("resolves row A seat 1 to the layout origin", () => {
    const layout = SECTION_LAYOUTS["north-lower"];
    const loc = resolveSeatLocation("north-lower", "A", "1");
    expect(loc).not.toBeNull();
    expect(loc!.lat).toBeCloseTo(layout.origin.lat, 9);
    expect(loc!.lng).toBeCloseTo(layout.origin.lng, 9);
  });

  it("moves deeper into the stand as the row letter increases", () => {
    const a = resolveSeatLocation("north-lower", "A", "1")!;
    const t = resolveSeatLocation("north-lower", "T", "1")!;
    expect(t.lat).toBeGreaterThan(a.lat); // north-lower rows run north
  });

  it("moves along the row as the seat number increases", () => {
    const s1 = resolveSeatLocation("north-lower", "A", "1")!;
    const s32 = resolveSeatLocation("north-lower", "A", "32")!;
    expect(s32.lng).toBeGreaterThan(s1.lng); // seats run east
  });

  it("accepts lowercase row letters", () => {
    const upper = resolveSeatLocation("north-lower", "C", "5")!;
    const lower = resolveSeatLocation("north-lower", "c", "5")!;
    expect(lower.lat).toBeCloseTo(upper.lat, 12);
    expect(lower.lng).toBeCloseTo(upper.lng, 12);
  });

  it("falls back to the middle of the section when only one axis is known", () => {
    const mid = resolveSeatLocation("north-lower", "A", undefined);
    expect(mid).not.toBeNull();
    const s1 = resolveSeatLocation("north-lower", "A", "1")!;
    // Mid-seat fallback should be further east than seat 1.
    expect(mid!.lng).toBeGreaterThan(s1.lng);
  });

  it("clamps out-of-range seat numbers to the last seat in the row", () => {
    const layout = SECTION_LAYOUTS["north-lower"];
    const beyond = resolveSeatLocation("north-lower", "A", "999")!;
    const last = resolveSeatLocation(
      "north-lower",
      "A",
      String(layout.seatsPerRow)
    )!;
    expect(beyond.lng).toBeCloseTo(last.lng, 12);
  });
});
