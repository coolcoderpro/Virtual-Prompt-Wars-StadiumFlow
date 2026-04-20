/**
 * Pure prompt-assembly helpers for /api/chat.
 *
 * Everything that *shapes* the LLM input — history normalisation, seat
 * context, live-venue context, provider selection — lives here so the HTTP
 * handler stays thin and the logic is unit-testable without network or a
 * Firestore Admin stub. The route keeps I/O (Zod validation, Firestore
 * read, streaming bridges) and delegates prompt construction here.
 */

import { distanceMeters } from "./suggest";
import { CROWD_LABELS } from "./crowd";
import { getMatchState, phaseContextForAI } from "./matchPhase";
import { POI_META, VENUE_SYSTEM_PROMPT } from "./venueKnowledge";
import type { Poi, Section, Venue } from "./types";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type Provider = "gemini" | "groq";
export type LiveData = { venue: Venue; pois: Poi[]; sections: Section[] };

export interface SeatContext {
  row?: string;
  seat?: string;
  partySize?: number;
  hasAccessibilityNeeds?: boolean;
}

/**
 * Pick which LLM provider to use. Explicit `AI_PROVIDER` wins; otherwise
 * prefer Gemini if its key is set, else fall back to Groq.
 *
 * The env source is injectable so unit tests can drive every branch without
 * mutating `process.env`.
 */
export function selectedProvider(
  env: Record<string, string | undefined> = process.env
): Provider {
  const raw = (env.AI_PROVIDER ?? "").toLowerCase();
  if (raw === "gemini") return "gemini";
  if (raw === "groq") return "groq";
  if (env.GEMINI_API_KEY) return "gemini";
  return "groq";
}

/** Format a fan's seat + party + accessibility preferences as prompt lines. */
export function formatSeatContext(seat: SeatContext | undefined): string[] {
  if (!seat) return [];
  const lines: string[] = [];
  const parts: string[] = [];
  if (seat.row) parts.push(`row ${seat.row}`);
  if (seat.seat) parts.push(`seat ${seat.seat}`);
  const seatLabel = parts.join(", ");
  if (seatLabel) lines.push(`Seat: ${seatLabel}.`);
  if (seat.partySize && seat.partySize > 1) {
    lines.push(
      `Group of ${seat.partySize}. Favour places that can realistically serve a group that size without a huge queue, and mention if a single member could queue while others wait.`
    );
  }
  if (seat.hasAccessibilityNeeds) {
    lines.push(
      "Accessibility: ONLY recommend POIs flagged accessible; prefer step-free routes."
    );
  }
  return lines;
}

/** Render the current Firestore venue snapshot as an LLM-readable block. */
export function formatLiveContext(data: LiveData, sectionId?: string): string {
  const section = sectionId
    ? data.sections.find((s) => s.id === sectionId)
    : undefined;
  const origin = section?.location ?? data.venue.center;
  const originLabel = section?.label ?? "venue centre";

  const rows = data.pois
    .slice()
    .sort(
      (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
    )
    .map((p) => {
      const meta = POI_META[p.id] ?? {};
      const dist = Math.round(distanceMeters(origin, p.location));
      const crowd = CROWD_LABELS[p.crowdLevel];
      const features = meta.features?.length
        ? ` | serves: ${meta.features.join(", ")}`
        : "";
      const access = meta.accessible ? " | accessible" : "";
      const notes = meta.notes ? ` | ${meta.notes}` : "";
      return `- ${p.name} (${p.type}) — ${crowd}, wait ${p.waitMinutes} min, ${dist} m from ${originLabel}${access}${features}${notes}`;
    })
    .join("\n");

  const sectionList = data.sections
    .map((s) => `- ${s.label} (id: ${s.id})`)
    .join("\n");

  return `LIVE VENUE STATE (refreshed now):
Origin: ${originLabel}

Sections:
${sectionList}

Points of interest:
${rows}`;
}

/** Assemble the full system prompt: persona + phase + seat + live state. */
export function buildSystemPrompt(
  data: LiveData,
  sectionId: string | undefined,
  seat: SeatContext | undefined
): string {
  const matchState = getMatchState();
  const seatLines = formatSeatContext(seat);
  return [
    VENUE_SYSTEM_PROMPT,
    "",
    `MATCH PHASE: ${matchState.label} (${matchState.clock}).`,
    phaseContextForAI(matchState),
    ...(seatLines.length ? ["", "FAN CONTEXT:", ...seatLines] : []),
    "",
    formatLiveContext(data, sectionId),
  ].join("\n");
}

/**
 * Strip leading assistant turns and collapse consecutive same-role turns.
 * Both Groq and Gemini require alternation, and neither tolerates an
 * assistant turn at the head of history.
 */
export function normaliseHistory(messages: ChatTurn[]): ChatTurn[] {
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
