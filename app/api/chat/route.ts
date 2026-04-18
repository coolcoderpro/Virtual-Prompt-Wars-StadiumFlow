import { NextResponse } from "next/server";
import { z } from "zod";
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

type LiveData = { venue: Venue; pois: Poi[]; sections: Section[] };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

async function loadLive(venueId: string): Promise<LiveData | null> {
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
  return { venue, pois, sections };
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

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured on the server." },
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

  // Groq uses the OpenAI message shape: a single system message followed by
  // alternating user/assistant turns. The last turn must be a user message.
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user." },
      { status: 400 }
    );
  }

  // Groq/Llama requires the first non-system turn to be a user message.
  // The client seeds an assistant greeting for UX — strip any leading
  // assistant turns and collapse consecutive same-role turns.
  const cleaned = messages.filter((m) => m.content.trim().length > 0);
  const firstUserIdx = cleaned.findIndex((m) => m.role === "user");
  const trimmed = firstUserIdx === -1 ? [] : cleaned.slice(firstUserIdx);
  const convo: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of trimmed) {
    if (convo.length > 0 && convo[convo.length - 1].role === m.role) continue;
    convo.push({ role: m.role, content: m.content });
  }

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...convo,
  ];

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
      messages: chatMessages,
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

  // Parse the upstream SSE stream and re-emit just the content deltas as plain
  // text so the existing client reader keeps working unchanged.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = groqRes.body.getReader();

  const stream = new ReadableStream({
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
