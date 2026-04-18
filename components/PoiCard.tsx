"use client";

import clsx from "clsx";
import { CROWD_COLORS, CROWD_ICONS, CROWD_LABELS } from "@/lib/crowd";
import type { Poi } from "@/lib/types";

interface Props {
  poi: Poi;
  distance: number | null;
}

function formatDistance(m: number | null): string {
  if (m === null) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function PoiCard({ poi, distance }: Props) {
  const label = CROWD_LABELS[poi.crowdLevel];
  const color = CROWD_COLORS[poi.crowdLevel];
  const icon = CROWD_ICONS[poi.crowdLevel];

  return (
    <article
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      aria-label={`${poi.name}, ${label}, ${poi.waitMinutes} minute wait`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{poi.name}</div>
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {poi.type}
          {distance !== null && (
            <>
              <span aria-hidden> &middot; </span>
              <span>{formatDistance(distance)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs text-white",
            color
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="text-right text-xs">
          <div className="font-medium">{label}</div>
          <div className="text-slate-500 dark:text-slate-400">
            {poi.waitMinutes} min
          </div>
        </div>
      </div>
    </article>
  );
}
