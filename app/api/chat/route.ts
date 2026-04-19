import { NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdmin } from "@/lib/firebaseAdmin";
import { distanceMeters } from "@/lib/suggest";
import { CROWD_LABELS } from "@/lib/crowd";
import { getMatchState, phaseContextForAI } from "@/lib/matchPhase";
import { POI_META, VENUE_SYSTEM_PROMPT } from "@/lib/venueKnowledge";
import type { Poi, Section, Venue } from "@/lib/types";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const BodySchema = z.object({
  venueId: z.string().min(1).max(64).default("wembley"),
  sectionId: z.string().max(64).optional(),
  seat: z
    .object({
      row: z.string().max(8).optional(),
      seat: z.string().max(8).optional(),
      partySize: z.number().int().min(1).max(20).optional(),
      hasAccessibilityNeeds: z.boolean().optional(),
    })
    .optional(),
  messages: z.array(MessageSchema).min(1).max(30),
});

type ChatTurn = { role: "user" | "assistant"; content: string };
type LiveData = { venue: Venue; pois: Poi[]; sections: Section[] };
type Provider = "gemini" | "groq";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// Simulator writes POI crowd/wait every 5s, so a 3s cache is fresh enough for
// chat guidance while collapsing bursts (proactive alerts + user chat) into one
// Firestore read per venue.
const LIVE_CACHE_TTL_MS = 3_000;
const liveCache = new Map<string, { expires: number; data: LiveData }>();

function selectedProvider(): Provider {
  const raw = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (raw === "gemini") return "gemini";
  if (raw === "groq") return "groq";
  // Auto: prefer Gemini if its key is set, else fall back to Groq.
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "groq";
}

async function loadLive(venueId: string): Promise<LiveData | null> {
  const now = Date.now();
  const hit = liveCache.get(venueId);
  if (hit && hit.expires > now) return hit.data;

  const { db } = getAdmin();
  const venueSnap = await db.collection("venues").doc(venueId).get();
  if (!venueSnap.exists) return null;

  const [poisSnap, sectionsSnap] = await Promise.all([
    db.collection("venues").doc(venueId).collection("pois").get(),
    db.collection("venues").doc(venueId).collection("sections").get(),
  ]);

  const venue: Venue = { id: venueSnap.id, ...(venueSnap.data() as Omit<Venue, "id">) };
  const pois: Poi[] = poisSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Poi, "id">) }));
  const sections: Section[] = sectionsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Section, "id">),
  }));
  const data: LiveData = { venue, pois, sections };
  liveCache.set(venueId, { expires: now + LIVE_CACHE_TTL_MS, data });
  return data;
}

function formatLiveContext(data: LiveData, sectionId?: string): string {
  const section = sectionId ? data.sections.find((s) => s.id === sectionId) : undefined;
  const origin = section?.location ?? data.venue.center;
  const originLabel = section?.label ?? "venue centre";

  const rows = data.pois
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    .map((p) => {
      const meta = POI_META[p.id] ?? {};
      const dist = Math.round(distanceMeters(origin, p.location));
      const crowd = CROWD_LABELS[p.crowdLevel];
      const features = meta.features?.length ? ` | serves: ${meta.features.join(", ")}` : "";
      const access = meta.accessible ? " | accessible" : "";
      const notes = meta.notes ? ` | ${meta.notes}` : "";
      return `- ${p.name} (${p.type}) — ${crowd}, wait ${p.waitMinutes} min, ${dist} m from ${originLabel}${access}${features}${notes}`;
    })
    .join("\n");

  const sectionList = data.sections.map((s) => `- ${s.label} (id: ${s.id})`).join("\n");

  return `LIVE VENUE STATE (refreshed now):
Origin: ${originLabel}

Sections:
${sectionList}

Points of interest:
${rows}`;
}

/** Strip leading assistant turns and collapse consecutive same-role turns. */
function normaliseHistory(messages: ChatTurn[]): ChatTurn[] {
  const cleaned = messages.filter((m) => m.content.trim().length > 0);
  const firstUserIdx = cleaned.findIndex((m) => m.role === "user");
  const trimmed = firstUserIdx === -1 ? [] : cleaned.slice(firstUserIdx);
  const convo: ChatTurn[] = [];
  for (const m of trimmed) {
    if (convo.length > 0 && convo[convo.length - 1].role === m.role) continue;
    convo.push({ role: m.role, content: m.content });
  }
  return convo;
}

function plainTextResponse(stream: ReadableStream<Uint8Array>, provider: Provider): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-AI-Provider": provider,
    },
  });
}

async function streamFromGroq(
  systemPrompt: string,
  convo: ChatTurn[]
): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY!;
  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...convo],
      temperature: 0.4,
      max_tokens: 400,
      stream: true,
    }),
  });

  if (!groqRes.ok || !groqRes.body) {
    const errText = await groqRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Groq error ${groqRes.status}: ${errText || groqRes.statusText}` },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = groqRes.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta: string | undefined = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // Ignore malformed chunks — Groq occasionally sends keep-alives.
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[stream error: ${(err as Error).message}]`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return plainTextResponse(stream, "groq");
}

async function streamFromGemini(
  systemPrompt: string,
  convo: ChatTurn[]
): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const modelName = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  });

  // Gemini takes (history, latest user message) separately.
  const history = convo.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastUser = convo[convo.length - 1];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(lastUser.content);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[stream error: ${(err as Error).message}]`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return plainTextResponse(stream, "gemini");
}

export async function POST(req: Request) {
  const provider = selectedProvider();
  if (provider === "groq" && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured on the server." },
      { status: 500 }
    );
  }
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured on the server." },
      { status: 500 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { venueId, sectionId, seat, messages } = parsed.data;

  const data = await loadLive(venueId);
  if (!data) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const matchState = getMatchState();
  const seatLines: string[] = [];
  if (seat) {
    const parts: string[] = [];
    if (seat.row) parts.push(`row ${seat.row}`);
    if (seat.seat) parts.push(`seat ${seat.seat}`);
    const seatLabel = parts.join(", ");
    if (seatLabel) seatLines.push(`Seat: ${seatLabel}.`);
    if (seat.partySize && seat.partySize > 1)
      seatLines.push(
        `Group of ${seat.partySize}. Favour places that can realistically serve a group that size without a huge queue, and mention if a single member could queue while others wait.`
      );
    if (seat.hasAccessibilityNeeds)
      seatLines.push(
        "Accessibility: ONLY recommend POIs flagged accessible; prefer step-free routes."
      );
  }

  const systemPrompt = [
    VENUE_SYSTEM_PROMPT,
    "",
    `MATCH PHASE: ${matchState.label} (${matchState.clock}).`,
    phaseContextForAI(matchState),
    ...(seatLines.length ? ["", "FAN CONTEXT:", ...seatLines] : []),
    "",
    formatLiveContext(data, sectionId),
  ].join("\n");

  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user." },
      { status: 400 }
    );
  }

  const convo = normaliseHistory(messages);
  if (convo.length === 0 || convo[convo.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Conversation must end with a user message." },
      { status: 400 }
    );
  }

  return provider === "gemini"
    ? streamFromGemini(systemPrompt, convo)
    : streamFromGroq(systemPrompt, convo);
}
