"use client";

export interface SeatProfile {
  sectionId: string;
  row?: string;
  seat?: string;
  partySize: number;
  hasAccessibilityNeeds?: boolean;
}

const KEY = "stadiumflow.seat";

export function loadSeat(): SeatProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.sectionId !== "string" || parsed.sectionId.length === 0) return null;
    if (typeof parsed.partySize !== "number" || parsed.partySize < 1) return null;
    return parsed as SeatProfile;
  } catch {
    return null;
  }
}

export function saveSeat(profile: SeatProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearSeat(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
