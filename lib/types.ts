/**
 * Shared domain types for StadiumFlow.
 * Kept framework-agnostic so server scripts, API routes and UI code can share them.
 */

export type LatLng = {
  lat: number;
  lng: number;
};

/** 0 = clear, 1 = moderate, 2 = busy, 3 = packed. -1 = unknown. */
export type CrowdLevel = -1 | 0 | 1 | 2 | 3;

export type PoiType = "gate" | "restroom" | "concession" | "merch" | "firstaid";

export interface Venue {
  id: string;
  name: string;
  center: LatLng;
  zoom: number;
}

export interface Poi {
  id: string;
  name: string;
  type: PoiType;
  location: LatLng;
  crowdLevel: CrowdLevel;
  waitMinutes: number;
  updatedAt: number; // epoch millis
}

export interface Section {
  id: string;
  label: string;
  location: LatLng;
}
