/**
 * Dummy but realistic seating geometry. Each section has an (A, 1) corner,
 * a row-direction vector (deeper into the stand) and a seat-direction vector
 * (along the row). Row letters go A upwards; row A is always closest to the
 * pitch. Seats are numbered 1..seatsPerRow left-to-right from that corner.
 *
 * Values are hand-tuned for Wembley so a seat change moves the "you are here"
 * pin by a few metres — enough for the AI to reason about nearby amenities.
 */
import type { LatLng } from "./types";

export interface SectionLayout {
  /** lat/lng of row A, seat 1 for this section. */
  origin: LatLng;
  /** Delta to add per row (A → B). Roughly 0.8m away from the pitch. */
  rowVec: { dLat: number; dLng: number };
  /** Delta to add per seat (seat 1 → 2). Roughly 0.6m along the row. */
  seatVec: { dLat: number; dLng: number };
  /** Row letters, A upwards. */
  rows: string[];
  seatsPerRow: number;
}

const ROWS_20 = "ABCDEFGHIJKLMNOPQRST".split(""); // A..T
const ROWS_PREMIUM = "ABCDEFGHIJKL".split("");    // A..L (smaller tier)

/** At ~lat 51.556: 1 m ≈ 0.000009° lat, 1 m ≈ 0.0000145° lng. */
const M_LAT = 0.000009;
const M_LNG = 0.0000145;

export const SECTION_LAYOUTS: Record<string, SectionLayout> = {
  "north-lower": {
    origin: { lat: 51.55646, lng: -0.28060 },
    rowVec: { dLat: 0.8 * M_LAT, dLng: 0 },   // rows go north (deeper)
    seatVec: { dLat: 0, dLng: 0.6 * M_LNG },  // seats go east
    rows: ROWS_20,
    seatsPerRow: 32,
  },
  "south-lower": {
    origin: { lat: 51.55554, lng: -0.28060 },
    rowVec: { dLat: -0.8 * M_LAT, dLng: 0 },  // rows go south (deeper)
    seatVec: { dLat: 0, dLng: 0.6 * M_LNG },
    rows: ROWS_20,
    seatsPerRow: 32,
  },
  "east-lower": {
    origin: { lat: 51.55560, lng: -0.27802 },
    rowVec: { dLat: 0, dLng: 0.8 * M_LNG },   // rows go east (deeper)
    seatVec: { dLat: 0.6 * M_LAT, dLng: 0 },  // seats go north
    rows: ROWS_20,
    seatsPerRow: 30,
  },
  "west-lower": {
    origin: { lat: 51.55560, lng: -0.28098 },
    rowVec: { dLat: 0, dLng: -0.8 * M_LNG },  // rows go west (deeper)
    seatVec: { dLat: 0.6 * M_LAT, dLng: 0 },
    rows: ROWS_20,
    seatsPerRow: 30,
  },
  "club-wembley": {
    // Premium middle tier, sits on the north side above the lower bowl.
    origin: { lat: 51.55640, lng: -0.28020 },
    rowVec: { dLat: 0.7 * M_LAT, dLng: 0 },
    seatVec: { dLat: 0, dLng: 0.55 * M_LNG },
    rows: ROWS_PREMIUM,
    seatsPerRow: 18,
  },
};

export function getLayout(sectionId: string): SectionLayout | null {
  return SECTION_LAYOUTS[sectionId] ?? null;
}

/** Parse a seat input ("12", "12a") into a 1-based integer, or null. */
export function parseSeatNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve a precise lat/lng for (section, row letter, seat number).
 * Returns null if the section has no layout or the coordinates are invalid.
 */
export function resolveSeatLocation(
  sectionId: string,
  row: string | undefined,
  seat: string | undefined
): LatLng | null {
  const layout = getLayout(sectionId);
  if (!layout) return null;

  const rowIdx = row ? layout.rows.indexOf(row.toUpperCase()) : -1;
  const seatNum = parseSeatNumber(seat);

  if (rowIdx < 0 && seatNum === null) return null;

  // Fall back to the middle of the section when one axis is missing.
  const rIdx = rowIdx < 0 ? Math.floor(layout.rows.length / 2) : rowIdx;
  const sIdx =
    seatNum === null
      ? Math.floor(layout.seatsPerRow / 2)
      : Math.min(layout.seatsPerRow, Math.max(1, seatNum)) - 1;

  return {
    lat:
      layout.origin.lat +
      layout.rowVec.dLat * rIdx +
      layout.seatVec.dLat * sIdx,
    lng:
      layout.origin.lng +
      layout.rowVec.dLng * rIdx +
      layout.seatVec.dLng * sIdx,
  };
}
