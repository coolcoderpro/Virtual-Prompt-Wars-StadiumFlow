"use client";

import { useEffect, useState } from "react";
import { getMatchState, type MatchState, type Phase } from "@/lib/matchPhase";

const STYLES: Record<Phase, { text: string; bg: string; dot: string }> = {
  "pre-match": {
    text: "text-amber-600",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  "first-half": {
    text: "text-green-600",
    bg: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    dot: "bg-green-500",
  },
  "half-time": {
    text: "text-orange-600",
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  "second-half": {
    text: "text-green-600",
    bg: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    dot: "bg-green-500",
  },
  "full-time": {
    text: "text-red-600",
    bg: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    dot: "bg-red-500",
  },
  exiting: {
    text: "text-purple-600",
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  "venue-clear": {
    text: "text-slate-600",
    bg: "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export default function MatchTimer() {
  const [state, setState] = useState<MatchState | null>(null);

  useEffect(() => {
    setState(getMatchState());
    const interval = setInterval(() => setState(getMatchState()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
        <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="text-sm font-bold text-slate-400">Loading…</span>
      </div>
    );
  }

  const style = STYLES[state.phase];

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${style.bg}`}>
      <span className="relative flex h-3 w-3">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.dot}`}
        />
        <span className={`relative inline-flex h-3 w-3 rounded-full ${style.dot}`} />
      </span>
      <span className={`text-sm font-bold ${style.text}`}>{state.label}</span>
      <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
        {state.clock}
      </span>
    </div>
  );
}
