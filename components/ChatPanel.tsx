"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { matchPoiNames, postChat, readTextStream } from "@/lib/chatClient";
import type { SeatProfile } from "@/lib/seatStorage";
import type { Poi } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** POI ids mentioned by the assistant so the map can highlight them. */
  pois?: string[];
}

interface Props {
  venueId: string;
  sectionId: string;
  seat: SeatProfile | null;
  pois: Poi[];
  /** Called with the POI ids the assistant just recommended. */
  onHighlight?: (poiIds: string[]) => void;
}

const QUICK_PROMPTS: string[] = [
  "Where's the closest restroom with no queue?",
  "Where should I grab food right now?",
  "What's the fastest exit when the match ends?",
  "Any accessible restroom near me?",
];

export default function ChatPanel({ venueId, sectionId, seat, pois, onHighlight }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I can see every queue, gate and concession in real time. Ask me anything — or tap a shortcut below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages: Message[] = [
      ...messages,
      userMsg,
      { role: "assistant", content: "" },
    ];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Payload is the history we want the model to see: every real turn so far
    // plus the new user question. Drop empty turns (the streaming placeholder).
    const payloadMessages = [...messages, userMsg]
      .filter((m) => m.content.trim().length > 0)
      .map(({ role, content }) => ({ role, content }));

    const startedAt = performance.now();
    track("chat_send", {
      length: text.trim().length,
      hasSeat: !!seat,
      hasSection: !!sectionId,
    });

    try {
      const res = await postChat("chat_request", {
        venueId,
        sectionId: sectionId || undefined,
        seat: seat
          ? {
              row: seat.row,
              seat: seat.seat,
              partySize: seat.partySize,
              hasAccessibilityNeeds: seat.hasAccessibilityNeeds,
            }
          : undefined,
        messages: payloadMessages,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error ?? "Chat request failed");
      }

      const acc = await readTextStream(res, (accum) => {
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: accum };
          return copy;
        });
      });

      const matched = matchPoiNames(acc, pois);
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { role: "assistant", content: acc, pois: matched };
        return copy;
      });
      if (matched.length > 0) {
        onHighlight?.(matched);
        track("poi_highlight", { count: matched.length, source: "chat" });
      }
      track("chat_response", {
        latencyMs: Math.round(performance.now() - startedAt),
        chars: acc.length,
        poiCount: matched.length,
      });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
      track("chat_error", { message });
    } finally {
      setStreaming(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        aria-label="Open StadiumFlow assistant"
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        Ask StadiumFlow
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[540px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold">StadiumFlow Assistant</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live venue data • powered by Google AI
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Close assistant"
        >
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-busy={streaming}
        aria-label="Assistant conversation"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">⚠ {error}</p>
        )}
      </div>

      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="mb-2 flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                track("quick_prompt_click", { prompt: q });
                send(q);
              }}
              disabled={streaming}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about queues, exits, food…"
            disabled={streaming}
            className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Ask the stadium assistant"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {streaming ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
