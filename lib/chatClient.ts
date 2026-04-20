/**
 * Shared client for talking to /api/chat.
 *
 * Consolidates the payload shape, traced-fetch wrapping, stream reading, and
 * POI-name matching used by both ChatPanel (incremental UI) and
 * ProactiveAlerts (one-shot toasts). Keeping this in one place makes the
 * wire contract single-sourced and testable.
 */

import { tracedFetch } from "./performance";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSeatInput {
  row?: string;
  seat?: string;
  partySize?: number;
  hasAccessibilityNeeds?: boolean;
}

export interface ChatPayload {
  venueId: string;
  sectionId?: string;
  seat?: ChatSeatInput;
  messages: ChatMessage[];
}

/** POST to /api/chat wrapped in a named Firebase Performance trace. */
export async function postChat(
  traceName: string,
  payload: ChatPayload
): Promise<Response> {
  return tracedFetch(traceName, "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Read the plain-text body of a streaming chat response to completion.
 * `onChunk` fires with the running accumulator after each decode so callers
 * can incrementally render. Returns the full accumulated text.
 */
export async function readTextStream(
  res: Response,
  onChunk?: (accumulated: string) => void
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onChunk?.(acc);
  }
  return acc;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find POIs whose names appear in `text` as whole words (case-insensitive).
 *
 * Uses negative look-around on word characters rather than `\b` so names
 * that end in non-word punctuation (e.g. `"Bar (North)"`) still match when
 * followed by whitespace — `\b` only triggers between a word and a
 * non-word character, so it fails on names that end in punctuation.
 * The main win is preventing "Gate A" from substring-matching inside
 * "Gate AB".
 */
export function matchPoiNames(
  text: string,
  pois: ReadonlyArray<{ id: string; name: string }>
): string[] {
  if (!text) return [];
  return pois
    .filter((p) =>
      new RegExp(`(?<!\\w)${escapeRegExp(p.name)}(?!\\w)`, "i").test(text)
    )
    .map((p) => p.id);
}
