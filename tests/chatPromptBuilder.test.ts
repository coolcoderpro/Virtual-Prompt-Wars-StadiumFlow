/**
 * Unit tests for the pure prompt-assembly helpers used by /api/chat.
 *
 * These cover selection, history normalisation, seat formatting, and the
 * composed system prompt — all free of network, Firestore, and the Zod
 * boundary so they run in a couple of milliseconds.
 */

import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  formatSeatContext,
  normaliseHistory,
  selectedProvider,
  type LiveData,
} from "@/lib/chatPromptBuilder";

const sampleLive: LiveData = {
  venue: {
    id: "wembley",
    name: "Wembley",
    center: { lat: 51.556, lng: -0.2795 },
    zoom: 17,
  },
  pois: [
    {
      id: "wc-n1",
      name: "Restroom N1",
      type: "restroom",
      location: { lat: 51.5562, lng: -0.2795 },
      crowdLevel: 1,
      waitMinutes: 2,
      updatedAt: 0,
    },
    {
      id: "gate-a",
      name: "Gate A",
      type: "gate",
      location: { lat: 51.5565, lng: -0.2793 },
      crowdLevel: 2,
      waitMinutes: 5,
      updatedAt: 0,
    },
  ],
  sections: [
    {
      id: "north-lower",
      label: "North Lower",
      location: { lat: 51.5561, lng: -0.2795 },
    },
  ],
};

describe("selectedProvider", () => {
  it("honours an explicit gemini override", () => {
    expect(selectedProvider({ AI_PROVIDER: "gemini" })).toBe("gemini");
  });

  it("honours an explicit groq override", () => {
    expect(
      selectedProvider({ AI_PROVIDER: "groq", GEMINI_API_KEY: "ignored" })
    ).toBe("groq");
  });

  it("auto-picks gemini when only the Gemini key is set", () => {
    expect(selectedProvider({ GEMINI_API_KEY: "abc" })).toBe("gemini");
  });

  it("falls back to groq when no key is set", () => {
    expect(selectedProvider({})).toBe("groq");
  });

  it("ignores unrecognised AI_PROVIDER values", () => {
    expect(selectedProvider({ AI_PROVIDER: "claude" })).toBe("groq");
  });
});

describe("formatSeatContext", () => {
  it("returns an empty array when no seat is provided", () => {
    expect(formatSeatContext(undefined)).toEqual([]);
  });

  it("produces a seat label line when row and seat are both set", () => {
    const lines = formatSeatContext({ row: "12", seat: "34" });
    expect(lines[0]).toBe("Seat: row 12, seat 34.");
  });

  it("omits the party-size line for solo fans", () => {
    const lines = formatSeatContext({ partySize: 1 });
    expect(lines.find((l) => l.includes("Group"))).toBeUndefined();
  });

  it("adds a group hint when partySize > 1", () => {
    const lines = formatSeatContext({ partySize: 4 });
    expect(lines.some((l) => l.includes("Group of 4"))).toBe(true);
  });

  it("flags accessibility constraints", () => {
    const lines = formatSeatContext({ hasAccessibilityNeeds: true });
    expect(lines.some((l) => l.toLowerCase().includes("accessibility"))).toBe(
      true
    );
  });
});

describe("normaliseHistory", () => {
  it("drops leading assistant turns", () => {
    const result = normaliseHistory([
      { role: "assistant", content: "hello" },
      { role: "user", content: "hi" },
    ]);
    expect(result).toEqual([{ role: "user", content: "hi" }]);
  });

  it("collapses consecutive same-role turns to the first one", () => {
    const result = normaliseHistory([
      { role: "user", content: "one" },
      { role: "user", content: "two" },
      { role: "assistant", content: "ok" },
      { role: "assistant", content: "also ok" },
      { role: "user", content: "three" },
    ]);
    expect(result).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "three" },
    ]);
  });

  it("drops empty-content turns", () => {
    const result = normaliseHistory([
      { role: "user", content: "   " },
      { role: "user", content: "real" },
    ]);
    expect(result).toEqual([{ role: "user", content: "real" }]);
  });

  it("returns empty when there are no user turns", () => {
    const result = normaliseHistory([
      { role: "assistant", content: "orphan" },
    ]);
    expect(result).toEqual([]);
  });
});

describe("buildSystemPrompt", () => {
  it("includes the venue persona, match phase, and live POI rows", () => {
    const prompt = buildSystemPrompt(sampleLive, "north-lower", undefined);
    expect(prompt).toContain("StadiumFlow");
    expect(prompt).toMatch(/MATCH PHASE:/);
    expect(prompt).toContain("Restroom N1");
    expect(prompt).toContain("Gate A");
    expect(prompt).toContain("North Lower");
  });

  it("injects a FAN CONTEXT section only when seat info is provided", () => {
    const without = buildSystemPrompt(sampleLive, undefined, undefined);
    expect(without).not.toContain("FAN CONTEXT");

    const withSeat = buildSystemPrompt(sampleLive, undefined, {
      row: "4",
      partySize: 3,
    });
    expect(withSeat).toContain("FAN CONTEXT");
    expect(withSeat).toContain("Group of 3");
  });

  it("uses the venue centre when no section is selected", () => {
    const prompt = buildSystemPrompt(sampleLive, undefined, undefined);
    expect(prompt).toContain("Origin: venue centre");
  });
});
