/**
 * Unit tests for the shared chat client helpers.
 *
 * matchPoiNames is the correctness-sensitive piece — it drives the map
 * highlight when the assistant mentions a POI, and the previous substring
 * implementation would falsely highlight "Gate A" whenever "Gate AB"
 * appeared. readTextStream covers the streaming read-to-end helper used by
 * ChatPanel (incremental) and ProactiveAlerts (one-shot).
 */

import { describe, expect, it } from "vitest";
import { matchPoiNames, readTextStream } from "@/lib/chatClient";

describe("matchPoiNames", () => {
  const pois = [
    { id: "gate-a", name: "Gate A" },
    { id: "gate-ab", name: "Gate AB" },
    { id: "wc-n1", name: "Restroom N1" },
    { id: "food-42", name: "Kiosk 42" },
  ];

  it("matches a full POI name bounded by punctuation or whitespace", () => {
    expect(matchPoiNames("Head to Gate A — shortest queue.", pois)).toEqual([
      "gate-a",
    ]);
  });

  it("does not substring-match 'Gate A' inside 'Gate AB'", () => {
    expect(matchPoiNames("Exit via Gate AB now.", pois)).toEqual(["gate-ab"]);
  });

  it("is case-insensitive", () => {
    expect(matchPoiNames("restroom n1 is open.", pois)).toEqual(["wc-n1"]);
  });

  it("returns ids for every POI that appears", () => {
    const text = "Try Gate A first, then Kiosk 42 for food.";
    expect(matchPoiNames(text, pois).sort()).toEqual(
      ["food-42", "gate-a"].sort()
    );
  });

  it("returns an empty array for empty or null-ish input", () => {
    expect(matchPoiNames("", pois)).toEqual([]);
  });

  it("ignores POI names with regex metacharacters safely", () => {
    // A name containing regex metacharacters must not throw or misbehave.
    const special = [{ id: "x", name: "Bar (North)" }];
    expect(matchPoiNames("Meet at Bar (North) now.", special)).toEqual(["x"]);
    expect(matchPoiNames("Meet at Bar South now.", special)).toEqual([]);
  });
});

describe("readTextStream", () => {
  function makeStreamResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  }

  it("concatenates chunks and returns the final string", async () => {
    const res = makeStreamResponse(["Hello, ", "world", "!"]);
    expect(await readTextStream(res)).toBe("Hello, world!");
  });

  it("invokes onChunk with the running accumulator", async () => {
    const res = makeStreamResponse(["a", "bc", "def"]);
    const seen: string[] = [];
    await readTextStream(res, (acc) => seen.push(acc));
    expect(seen).toEqual(["a", "abc", "abcdef"]);
  });

  it("returns empty string when the response has no body", async () => {
    const res = new Response(null, { status: 204 });
    expect(await readTextStream(res)).toBe("");
  });
});
