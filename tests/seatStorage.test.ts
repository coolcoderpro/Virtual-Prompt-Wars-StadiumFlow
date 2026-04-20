/**
 * Unit tests for the browser seat-profile persistence layer.
 *
 * Critical paths: a round-trip preserves the profile, and malformed or
 * legacy localStorage entries don't crash the dashboard boot.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSeat,
  loadSeat,
  saveSeat,
  type SeatProfile,
} from "@/lib/seatStorage";

const STORAGE_KEY = "stadiumflow.seat";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const ls: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  vi.stubGlobal("window", { localStorage: ls });
  return ls;
}

describe("seatStorage", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("round-trips a full profile", () => {
    const profile: SeatProfile = {
      sectionId: "north-lower",
      row: "C",
      seat: "12",
      partySize: 3,
      hasAccessibilityNeeds: true,
    };
    saveSeat(profile);
    expect(loadSeat()).toEqual(profile);
  });

  it("returns null when nothing has been stored", () => {
    expect(loadSeat()).toBeNull();
  });

  it("rejects payloads that are not objects", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify("a-string"));
    expect(loadSeat()).toBeNull();
  });

  it("rejects payloads missing a sectionId", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ partySize: 2 })
    );
    expect(loadSeat()).toBeNull();
  });

  it("rejects payloads with an invalid partySize", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sectionId: "north-lower", partySize: 0 })
    );
    expect(loadSeat()).toBeNull();
  });

  it("returns null when the raw JSON is garbage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json");
    expect(loadSeat()).toBeNull();
  });

  it("clearSeat removes a previously stored profile", () => {
    saveSeat({ sectionId: "north-lower", partySize: 1 });
    expect(loadSeat()).not.toBeNull();
    clearSeat();
    expect(loadSeat()).toBeNull();
  });
});
