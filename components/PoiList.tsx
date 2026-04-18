"use client";

import { useMemo } from "react";
import PoiCard from "./PoiCard";
import { distanceMeters } from "@/lib/suggest";
import type { LatLng, Poi } from "@/lib/types";

interface Props {
  pois: Poi[];
  origin: LatLng | null;
}

export default function PoiList({ pois, origin }: Props) {
  const sorted = useMemo(() => {
    if (!origin) return pois;
    return [...pois].sort(
      (a, b) =>
        distanceMeters(origin, a.location) - distanceMeters(origin, b.location)
    );
  }, [pois, origin]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No points of interest to show yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" role="list">
      {sorted.map((poi) => (
        <li key={poi.id}>
          <PoiCard
            poi={poi}
            distance={origin ? distanceMeters(origin, poi.location) : null}
          />
        </li>
      ))}
    </ul>
  );
}
