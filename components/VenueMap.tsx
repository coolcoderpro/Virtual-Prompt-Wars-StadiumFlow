"use client";

import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import type { LatLng, Poi, Venue } from "@/lib/types";

/** Background halo color per crowd level (transparent). */
const CROWD_HALO_COLOR: Record<number, string> = {
  [-1]: "rgba(107,114,128,0.18)",
  0: "rgba(22,163,74,0.20)",
  1: "rgba(234,179,8,0.22)",
  2: "rgba(249,115,22,0.25)",
  3: "rgba(220,38,38,0.28)",
};

/** Stroke color for halo ring. */
const CROWD_STROKE_COLOR: Record<number, string> = {
  [-1]: "rgba(107,114,128,0.4)",
  0: "rgba(22,163,74,0.45)",
  1: "rgba(234,179,8,0.5)",
  2: "rgba(249,115,22,0.55)",
  3: "rgba(220,38,38,0.6)",
};

/** Dot color (opaque people dots). */
const CROWD_DOT_COLOR: Record<number, string> = {
  [-1]: "#6b7280",
  0: "#16a34a",
  1: "#ca8a04",
  2: "#ea580c",
  3: "#dc2626",
};

/** How many people-dots to show per crowd level. */
const DOT_COUNTS: Record<number, number> = {
  [-1]: 0,
  0: 2,
  1: 5,
  2: 9,
  3: 15,
};

/** Halo radius in meters per crowd level. */
const HALO_RADIUS: Record<number, number> = {
  [-1]: 18,
  0: 20,
  1: 25,
  2: 30,
  3: 38,
};

/**
 * Generate random offsets around a center for people-dots.
 * Returns lat/lng pairs scattered within a radius.
 */
function scatterDots(
  center: LatLng,
  count: number,
  radiusMeters: number
): LatLng[] {
  const dots: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const dist = Math.random() * radiusMeters * 0.8;
    const dlat = (dist / 111320) * Math.cos(angle);
    const dlng =
      (dist / (111320 * Math.cos((center.lat * Math.PI) / 180))) *
      Math.sin(angle);
    dots.push({ lat: center.lat + dlat, lng: center.lng + dlng });
  }
  return dots;
}

/**
 * Scatter dots within a rectangular stand area.
 */
function scatterInRect(
  topLeft: LatLng,
  bottomRight: LatLng,
  count: number
): LatLng[] {
  const dots: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    dots.push({
      lat: topLeft.lat + Math.random() * (bottomRight.lat - topLeft.lat),
      lng: topLeft.lng + Math.random() * (bottomRight.lng - topLeft.lng),
    });
  }
  return dots;
}

/** POI type label abbreviations. */
const TYPE_LABEL: Record<string, string> = {
  gate: "G",
  restroom: "W",
  concession: "F",
  merch: "M",
  firstaid: "+",
};

function levelLabel(level: number): string {
  switch (level) {
    case 0: return "Clear";
    case 1: return "Moderate";
    case 2: return "Busy";
    case 3: return "Packed";
    default: return "Unknown";
  }
}

/** Stand definitions around the pitch. */
const STANDS = [
  {
    name: "North Stand",
    coords: [
      { lat: 51.55645, lng: -0.28060 },
      { lat: 51.55645, lng: -0.27840 },
      { lat: 51.55670, lng: -0.27830 },
      { lat: 51.55670, lng: -0.28070 },
    ],
    dotArea: {
      topLeft: { lat: 51.55670, lng: -0.28060 },
      bottomRight: { lat: 51.55645, lng: -0.27840 },
    },
  },
  {
    name: "South Stand",
    coords: [
      { lat: 51.55555, lng: -0.28060 },
      { lat: 51.55555, lng: -0.27840 },
      { lat: 51.55530, lng: -0.27830 },
      { lat: 51.55530, lng: -0.28070 },
    ],
    dotArea: {
      topLeft: { lat: 51.55555, lng: -0.28060 },
      bottomRight: { lat: 51.55530, lng: -0.27840 },
    },
  },
  {
    name: "East Stand",
    coords: [
      { lat: 51.55640, lng: -0.27840 },
      { lat: 51.55640, lng: -0.27800 },
      { lat: 51.55560, lng: -0.27800 },
      { lat: 51.55560, lng: -0.27840 },
    ],
    dotArea: {
      topLeft: { lat: 51.55640, lng: -0.27840 },
      bottomRight: { lat: 51.55560, lng: -0.27800 },
    },
  },
  {
    name: "West Stand",
    coords: [
      { lat: 51.55640, lng: -0.28100 },
      { lat: 51.55640, lng: -0.28060 },
      { lat: 51.55560, lng: -0.28060 },
      { lat: 51.55560, lng: -0.28100 },
    ],
    dotArea: {
      topLeft: { lat: 51.55640, lng: -0.28100 },
      bottomRight: { lat: 51.55560, lng: -0.28060 },
    },
  },
];

interface Props {
  venue: Venue | null;
  pois: Poi[];
  origin: LatLng | null;
  /** POI ids the AI is currently recommending — drawn with a pulsing ring. */
  highlightedPoiIds?: string[];
}

export default function VenueMap({ venue, pois, origin, highlightedPoiIds }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const dotMarkersRef = useRef<google.maps.Marker[]>([]);
  const standDotsRef = useRef<google.maps.Marker[]>([]);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const highlightRingsRef = useRef<google.maps.Circle[]>([]);
  const routeLinesRef = useRef<google.maps.Polyline[]>([]);

  // Initialise the map once the venue is available.
  useEffect(() => {
    if (!venue || !mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_MAPS_KEY;
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn("NEXT_PUBLIC_MAPS_KEY missing; map will not render.");
      return;
    }

    const loader = new Loader({ apiKey, version: "weekly" });
    let cancelled = false;

    loader.load().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = new google.maps.Map(mapRef.current, {
        center: venue.center,
        zoom: venue.zoom,
        disableDefaultUI: false,
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapInstanceRef.current = map;

      // Draw the football pitch rectangle
      const pitchCoords = [
        { lat: 51.55635, lng: -0.28050 },
        { lat: 51.55635, lng: -0.27850 },
        { lat: 51.55565, lng: -0.27850 },
        { lat: 51.55565, lng: -0.28050 },
      ];

      // Pitch background (green turf)
      new google.maps.Polygon({
        paths: pitchCoords,
        map,
        fillColor: "#2d8a4e",
        fillOpacity: 0.75,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        clickable: false,
        zIndex: 0,
      });

      // Centre line
      new google.maps.Polyline({
        path: [
          { lat: 51.55600, lng: -0.28050 },
          { lat: 51.55600, lng: -0.27850 },
        ],
        map,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        strokeOpacity: 0.8,
        clickable: false,
        zIndex: 0,
      });

      // Centre circle
      new google.maps.Circle({
        center: { lat: 51.55600, lng: -0.27950 },
        radius: 9.15,
        map,
        fillColor: "transparent",
        fillOpacity: 0,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        strokeOpacity: 0.8,
        clickable: false,
        zIndex: 0,
      });

      // Penalty boxes
      const penaltyBoxLeft = [
        { lat: 51.55620, lng: -0.28050 },
        { lat: 51.55620, lng: -0.28010 },
        { lat: 51.55580, lng: -0.28010 },
        { lat: 51.55580, lng: -0.28050 },
      ];
      const penaltyBoxRight = [
        { lat: 51.55620, lng: -0.27850 },
        { lat: 51.55620, lng: -0.27890 },
        { lat: 51.55580, lng: -0.27890 },
        { lat: 51.55580, lng: -0.27850 },
      ];

      [penaltyBoxLeft, penaltyBoxRight].forEach((box) => {
        new google.maps.Polygon({
          paths: box,
          map,
          fillColor: "transparent",
          fillOpacity: 0,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          strokeOpacity: 0.8,
          clickable: false,
          zIndex: 0,
        });
      });

      // Goal boxes
      const goalLeft = [
        { lat: 51.55608, lng: -0.28050 },
        { lat: 51.55608, lng: -0.28040 },
        { lat: 51.55592, lng: -0.28040 },
        { lat: 51.55592, lng: -0.28050 },
      ];
      const goalRight = [
        { lat: 51.55608, lng: -0.27850 },
        { lat: 51.55608, lng: -0.27860 },
        { lat: 51.55592, lng: -0.27860 },
        { lat: 51.55592, lng: -0.27850 },
      ];

      [goalLeft, goalRight].forEach((box) => {
        new google.maps.Polygon({
          paths: box,
          map,
          fillColor: "transparent",
          fillOpacity: 0,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          strokeOpacity: 0.9,
          clickable: false,
          zIndex: 0,
        });
      });

      // ---- Stands / Seating Sections ----
      STANDS.forEach((stand) => {
        new google.maps.Polygon({
          paths: stand.coords,
          map,
          fillColor: "#374151",
          fillOpacity: 0.35,
          strokeColor: "#6b7280",
          strokeWeight: 1,
          clickable: false,
          zIndex: 0,
        });

        // Stand label
        const center = {
          lat: stand.coords.reduce((s, c) => s + c.lat, 0) / stand.coords.length,
          lng: stand.coords.reduce((s, c) => s + c.lng, 0) / stand.coords.length,
        };
        new google.maps.Marker({
          position: center,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: stand.name,
            color: "#d1d5db",
            fontSize: "9px",
            fontWeight: "600",
          },
          clickable: false,
          zIndex: 0,
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [venue]);

  // Sync POI markers, halo circles, people dots, AND stand crowd dots.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous
    markersRef.current.forEach((m) => m.setMap(null));
    circlesRef.current.forEach((c) => c.setMap(null));
    dotMarkersRef.current.forEach((d) => d.setMap(null));
    standDotsRef.current.forEach((d) => d.setMap(null));

    const newMarkers: google.maps.Marker[] = [];
    const newCircles: google.maps.Circle[] = [];
    const newDots: google.maps.Marker[] = [];
    const newStandDots: google.maps.Marker[] = [];

    // Determine stand fill from gate crowd levels
    const gates = pois.filter((p) => p.type === "gate");
    const avgGateCrowd =
      gates.length > 0
        ? gates.reduce((s, p) => s + p.crowdLevel, 0) / gates.length
        : 0;
    // When gates are quiet (match in progress), stands are full
    const standFillRatio = avgGateCrowd < 1.5 ? 0.85 : 0.3;

    // Draw crowd dots in stands
    STANDS.forEach((stand) => {
      const maxDots = 40;
      const dotCount = Math.round(maxDots * standFillRatio);
      const standColor = standFillRatio > 0.6 ? "#3b82f6" : "#94a3b8";

      const positions = scatterInRect(
        stand.dotArea.topLeft,
        stand.dotArea.bottomRight,
        dotCount
      );
      positions.forEach((pos) => {
        const dot = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2.5,
            fillColor: standColor,
            fillOpacity: 0.7,
            strokeWeight: 0,
          },
          clickable: false,
          zIndex: 1,
        });
        newStandDots.push(dot);
      });
    });

    pois.forEach((poi) => {
      const level = poi.crowdLevel;

      // 1. Transparent halo circle
      const circle = new google.maps.Circle({
        center: poi.location,
        radius: HALO_RADIUS[level] ?? 20,
        map,
        fillColor: CROWD_HALO_COLOR[level] ?? "rgba(107,114,128,0.18)",
        fillOpacity: 1,
        strokeColor: CROWD_STROKE_COLOR[level] ?? "rgba(107,114,128,0.4)",
        strokeWeight: 1.5,
        clickable: false,
        zIndex: 1,
      });
      newCircles.push(circle);

      // 2. People dots scattered inside the halo
      const dotCount = DOT_COUNTS[level] ?? 0;
      const radius = HALO_RADIUS[level] ?? 20;
      const positions = scatterDots(poi.location, dotCount, radius);
      positions.forEach((pos) => {
        const dot = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3,
            fillColor: CROWD_DOT_COLOR[level] ?? "#6b7280",
            fillOpacity: 0.85,
            strokeColor: "#ffffff",
            strokeWeight: 0.5,
          },
          clickable: false,
          zIndex: 2,
        });
        newDots.push(dot);
      });

      // 3. Center label marker (POI type icon)
      const marker = new google.maps.Marker({
        position: poi.location,
        map,
        title: `${poi.name} — ${levelLabel(level)}, ~${poi.waitMinutes} min wait`,
        label: {
          text: TYPE_LABEL[poi.type] ?? "?",
          color: "#fff",
          fontSize: "11px",
          fontWeight: "700",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: CROWD_DOT_COLOR[level] ?? "#6b7280",
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 3,
      });
      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
    circlesRef.current = newCircles;
    dotMarkersRef.current = newDots;
    standDotsRef.current = newStandDots;
  }, [pois]);

  // Sync origin marker.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
      originMarkerRef.current = null;
    }
    if (origin) {
      originMarkerRef.current = new google.maps.Marker({
        position: origin,
        map,
        title: "You are here",
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        zIndex: 4,
      });
    }
  }, [origin]);

  // Highlight rings + origin→POI route lines for AI recommendations.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    highlightRingsRef.current.forEach((r) => r.setMap(null));
    routeLinesRef.current.forEach((l) => l.setMap(null));
    highlightRingsRef.current = [];
    routeLinesRef.current = [];

    const ids = highlightedPoiIds ?? [];
    if (ids.length === 0) return;

    const recommended = pois.filter((p) => ids.includes(p.id));
    recommended.forEach((poi) => {
      const ring = new google.maps.Circle({
        center: poi.location,
        radius: 55,
        map,
        fillColor: "transparent",
        fillOpacity: 0,
        strokeColor: "#0ea5e9",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        clickable: false,
        zIndex: 10,
      });
      highlightRingsRef.current.push(ring);

      if (origin) {
        const line = new google.maps.Polyline({
          path: [origin, poi.location],
          map,
          strokeColor: "#0ea5e9",
          strokeOpacity: 0,
          strokeWeight: 3,
          icons: [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: 1,
                strokeColor: "#0ea5e9",
                scale: 3,
              },
              offset: "0",
              repeat: "12px",
            },
          ],
          clickable: false,
          zIndex: 9,
        });
        routeLinesRef.current.push(line);
      }
    });
  }, [highlightedPoiIds, pois, origin]);

  if (!process.env.NEXT_PUBLIC_MAPS_KEY) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-100 p-6 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        Add <code className="font-mono">NEXT_PUBLIC_MAPS_KEY</code> to
        <code className="font-mono">.env.local</code> to load the map.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-full min-h-[320px] w-full"
      role="application"
      aria-label="Stadium map with crowd density"
    />
  );
}
