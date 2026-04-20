"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { matchPoiNames, postChat, readTextStream } from "@/lib/chatClient";
import { getMatchState, type Phase } from "@/lib/matchPhase";
import type { SeatProfile } from "@/lib/seatStorage";
import type { Poi } from "@/lib/types";

interface Props {
  venueId: string;
  sectionId: string;
  seat: SeatProfile | null;
  pois: Poi[];
  onHighlight?: (poiIds: string[]) => void;
}

interface Alert {
  id: number;
  text: string;
  pois: string[];
}

/** What triggers a proactive advisory. */
type Trigger =
  | { kind: "phase"; phase: Phase }
  | { kind: "packed-spike"; poiId: string };

function triggerPrompt(t: Trigger, pois: Poi[]): string | null {
  if (t.kind === "phase") {
    switch (t.phase) {
      case "half-time":
        return "Half-time just started. In ONE short sentence, name the single best restroom AND the single best concession to hit right now, with wait times. Format: 'Half-time tip: ...'";
      case "full-time":
        return "Full-time just blew. In ONE short sentence, recommend the best gate to exit from or whether to wait. Format: 'Exit tip: ...'";
      case "pre-match":
        return "Pre-match. In ONE short sentence, suggest the quickest gate to enter through right now. Format: 'Entry tip: ...'";
      default:
        return null;
    }
  }
  if (t.kind === "packed-spike") {
    const poi = pois.find((p) => p.id === t.poiId);
    if (!poi) return null;
    return `${poi.name} just hit PACKED (${poi.waitMinutes} min wait). In ONE short sentence, name a nearby alternative fans should go to instead.`;
  }
  return null;
}

export default function ProactiveAlerts({
  venueId,
  sectionId,
  seat,
  pois,
  onHighlight,
}: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const lastPhaseRef = useRef<Phase | null>(null);
  const firedPhasesRef = useRef<Set<Phase>>(new Set());
  const spikedRef = useRef<Set<string>>(new Set());
  const spikeCooldownRef = useRef<Map<string, number>>(new Map());
  const firingRef = useRef(false);
  const nextIdRef = useRef(1);

  // The simulator cycle loops every ~2 real minutes. Re-alerting the same
  // phase tip every cycle is noise — fire each phase at most once per session
  // (refresh to reset) and throttle PACKED spikes to once per POI per 3 min.
  const SPIKE_COOLDOWN_MS = 3 * 60_000;

  async function fire(trigger: Trigger) {
    if (firingRef.current) return;
    const prompt = triggerPrompt(trigger, pois);
    if (!prompt) return;

    firingRef.current = true;
    track("proactive_alert", {
      kind: trigger.kind,
      phase: trigger.kind === "phase" ? trigger.phase : undefined,
      poiId: trigger.kind === "packed-spike" ? trigger.poiId : undefined,
    });
    try {
      const res = await postChat("chat_proactive", {
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
        messages: [{ role: "user", content: prompt }],
      });
      if (!res.ok || !res.body) return;

      const text = (await readTextStream(res)).trim();
      if (!text) return;

      const matched = matchPoiNames(text, pois);

      const id = nextIdRef.current++;
      setAlerts((prev) => [...prev, { id, text, pois: matched }]);
      if (matched.length > 0) {
        onHighlight?.(matched);
        track("poi_highlight", { count: matched.length, source: "proactive" });
      }

      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 14_000);
    } finally {
      firingRef.current = false;
    }
  }

  // Phase-transition watcher. Fires at most once per phase per session.
  useEffect(() => {
    const check = () => {
      const { phase } = getMatchState();
      if (lastPhaseRef.current === null) {
        lastPhaseRef.current = phase;
        firedPhasesRef.current.add(phase); // skip the phase we mounted in
        return;
      }
      if (phase !== lastPhaseRef.current) {
        const previous = lastPhaseRef.current;
        lastPhaseRef.current = phase;
        track("phase_transition", { from: previous, to: phase });
        if (firedPhasesRef.current.has(phase)) return;
        firedPhasesRef.current.add(phase);
        fire({ kind: "phase", phase });
      }
    };
    check();
    const iv = setInterval(check, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, sectionId, pois]);

  // Crowd-spike watcher: fire once per POI when it hits PACKED, then cool down.
  useEffect(() => {
    const now = Date.now();
    pois.forEach((p) => {
      const key = p.id;
      const lastFired = spikeCooldownRef.current.get(key) ?? 0;
      if (p.crowdLevel === 3 && !spikedRef.current.has(key)) {
        spikedRef.current.add(key);
        if (now - lastFired > SPIKE_COOLDOWN_MS) {
          spikeCooldownRef.current.set(key, now);
          fire({ kind: "packed-spike", poiId: p.id });
        }
      } else if (p.crowdLevel <= 1 && spikedRef.current.has(key)) {
        spikedRef.current.delete(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois]);

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-30 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          role="status"
          className="pointer-events-auto rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="whitespace-pre-wrap">{a.text}</span>
            <button
              type="button"
              onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
              className="shrink-0 rounded p-0.5 text-amber-700 hover:bg-amber-200 dark:text-amber-200 dark:hover:bg-amber-800"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
