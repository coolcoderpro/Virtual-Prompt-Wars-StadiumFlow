/**
 * Integration test for /api/chat.
 *
 * The Firebase Admin SDK and Groq's HTTP endpoint are both stubbed so the
 * route exercises its real validation, prompt-assembly, and streaming code
 * paths against a deterministic fixture — no network, no service account.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route uses Groq in tests; Gemini key must be unset so selectedProvider() picks groq.
process.env.AI_PROVIDER = "groq";
process.env.GROQ_API_KEY = "test-key";
delete process.env.GEMINI_API_KEY;

const FAKE_VENUE = {
  id: "wembley",
  name: "Wembley",
  center: { lat: 51.556, lng: -0.2795 },
};
const FAKE_POIS = [
  {
    id: "wc-n1",
    name: "Restroom N1",
    type: "restroom",
    location: { lat: 51.5562, lng: -0.2795 },
    crowdLevel: 1,
    waitMinutes: 2,
    updatedAt: 0,
  },
];
const FAKE_SECTIONS = [
  { id: "north-lower", label: "North Lower", location: { lat: 51.5561, lng: -0.2795 } },
];

function fakeSnap<T extends { id: string }>(row: T, exists = true) {
  const { id, ...rest } = row;
  return { exists, id, data: () => rest };
}

function fakeCollection<T extends { id: string }>(rows: T[]) {
  return { get: async () => ({ docs: rows.map((r) => fakeSnap(r)) }) };
}

vi.mock("@/lib/firebaseAdmin", () => {
  const db = {
    collection(name: string) {
      if (name !== "venues") throw new Error(`unexpected collection ${name}`);
      return {
        doc: (venueId: string) => ({
          get: async () =>
            venueId === FAKE_VENUE.id
              ? fakeSnap(FAKE_VENUE)
              : { exists: false, id: venueId, data: () => undefined },
          collection(sub: string) {
            if (sub === "pois") return fakeCollection(FAKE_POIS);
            if (sub === "sections") return fakeCollection(FAKE_SECTIONS);
            throw new Error(`unexpected subcollection ${sub}`);
          },
        }),
      };
    },
  };
  return { getAdmin: () => ({ app: {}, db }) };
});

/** Build a Groq-style SSE stream Response from a list of content deltas. */
function groqSseResponse(deltas: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const d of deltas) {
        const chunk =
          `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function collectStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function loadPost() {
  const mod = await import("@/app/api/chat/route");
  return mod.POST;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/chat route", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => groqSseResponse(["Try ", "Restroom N1."]))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rejects an invalid body with 400", async () => {
    const POST = await loadPost();
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects a 404 when the venue is not found", async () => {
    const POST = await loadPost();
    const res = await POST(
      makeRequest({
        venueId: "not-a-real-venue",
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects when the conversation does not end with a user turn", async () => {
    const POST = await loadPost();
    const res = await POST(
      makeRequest({
        venueId: "wembley",
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("streams Groq deltas back as plain text", async () => {
    const POST = await loadPost();
    const res = await POST(
      makeRequest({
        venueId: "wembley",
        sectionId: "north-lower",
        messages: [{ role: "user", content: "where's the closest restroom?" }],
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Provider")).toBe("groq");
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    const text = await collectStream(res);
    expect(text).toBe("Try Restroom N1.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("passes the system prompt and user message through to Groq", async () => {
    const POST = await loadPost();
    await POST(
      makeRequest({
        venueId: "wembley",
        sectionId: "north-lower",
        messages: [{ role: "user", content: "nearest loo?" }],
      })
    );
    const [, init] = (fetch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("StadiumFlow");
    expect(body.messages[body.messages.length - 1]).toEqual({
      role: "user",
      content: "nearest loo?",
    });
  });
});
