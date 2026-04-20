/**
 * Suggestion scoring for StadiumFlow POIs.
 *
 * `distanceMeters` — straight-line distance over the geoid (Haversine).
 * `suggest` — ranks POIs of a given type by a weighted score combining
 * walking distance, predicted wait time, and reported crowd level. Lower
 * is better.
 *
 * Kept dependency-free so the same helpers run on the server (system-prompt
 * construction) and the client (SuggestionBar) without a runtime divide.
 */
import type { LatLng, Poi, PoiType } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres between two lat/lng points. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface SuggestOptions {
  /** Weight given to distance vs. crowd+wait. Default = 1. */
  distanceWeight?: number;
  /** Weight given to waiting time. Default = 2 (minutes). */
  waitWeight?: number;
  /** Weight given to crowd level (0-3). Default = 30 (approx 30m per level). */
  crowdWeight?: number;
}

/**
 * Returns POIs of a given type, ranked by a score that combines walking distance,
 * predicted wait time, and reported crowd level. Lower score is better.
 * Unknown crowd levels (-1) are treated as "moderate" to avoid punishing or
 * rewarding unreported amenities too heavily.
 */
export function suggest(
  pois: Poi[],
  origin: LatLng,
  type: PoiType,
  opts: SuggestOptions = {}
): Array<Poi & { score: number; distance: number }> {
  const distanceWeight = opts.distanceWeight ?? 1;
  const waitWeight = opts.waitWeight ?? 2;
  const crowdWeight = opts.crowdWeight ?? 30;

  return pois
    .filter((p) => p.type === type)
    .map((p) => {
      const distance = distanceMeters(origin, p.location);
      const crowd = p.crowdLevel < 0 ? 1 : p.crowdLevel;
      const score =
        distance * distanceWeight +
        p.waitMinutes * waitWeight * 10 +
        crowd * crowdWeight * 10;
      return { ...p, distance, score };
    })
    .sort((a, b) => a.score - b.score);
}
