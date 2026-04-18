"use client";

import { useMemo } from "react";
import { suggest } from "@/lib/suggest";
import type { LatLng, Poi, PoiType } from "@/lib/types";

interface Props {
  pois: Poi[];
  origin: LatLng | null;
}

const TARGETS: { type: PoiType; label: string }[] = [
  { type: "restroom", label: "Restroom" },
  { type: "concession", label: "Concession" },
  { type: "gate", label: "Exit gate" },
];

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function SuggestionBar({ pois, origin }: Props) {
  const picks = useMemo(() => {
    if (!origin) return [];
    return TARGETS.map((t) => {
      const [best] = suggest(pois, origin, t.type);
      return { ...t, best };
    }).filter((p) => p.best);
  }, [pois, origin]);

  if (picks.length === 0) {
    return (
      <div className="border-b border-slate-200 bg-slate-100 px-6 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Pick a section above to get personalised suggestions.
      </div>
    );
  }

  return (
    <div className="grid gap-2 border-b border-slate-200 bg-slate-100 px-6 py-3 text-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
      {picks.map(({ type, label, best }) => (
        <div
          key={type}
          className="rounded-md bg-white p-2 shadow-sm dark:bg-slate-800"
        >
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="truncate font-medium">{best.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {formatDistance(best.distance)} &middot; {best.waitMinutes} min wait
          </div>
        </div>
      ))}
    </div>
  );
}
