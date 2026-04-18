"use client";

import { useEffect, useMemo, useState } from "react";
import { usePois, useSections, useVenue } from "@/lib/firestoreHooks";
import { resolveSeatLocation } from "@/lib/seatLayout";
import { loadSeat, saveSeat, type SeatProfile } from "@/lib/seatStorage";
import ChatPanel from "./ChatPanel";
import MatchTimer from "./MatchTimer";
import PoiList from "./PoiList";
import ProactiveAlerts from "./ProactiveAlerts";
import SeatSetup from "./SeatSetup";
import SuggestionBar from "./SuggestionBar";
import VenueMap from "./VenueMap";
import type { PoiType } from "@/lib/types";

const FILTER_TYPES: { label: string; value: PoiType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Gates", value: "gate" },
  { label: "Restrooms", value: "restroom" },
  { label: "Concessions", value: "concession" },
  { label: "Merch", value: "merch" },
  { label: "First Aid", value: "firstaid" },
];

export default function Dashboard({ venueId }: { venueId: string }) {
  const { venue, error: venueError } = useVenue(venueId);
  const { pois, error: poiError } = usePois(venueId);
  const { sections } = useSections(venueId);

  const [filter, setFilter] = useState<PoiType | "all">("all");
  const [highlightedPoiIds, setHighlightedPoiIds] = useState<string[]>([]);
  const [seat, setSeat] = useState<SeatProfile | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [seatLoaded, setSeatLoaded] = useState(false);

  useEffect(() => {
    const existing = loadSeat();
    setSeat(existing);
    setSeatLoaded(true);
  }, []);

  // First visit (no seat stored yet + sections loaded): auto-open the modal.
  useEffect(() => {
    if (!seatLoaded) return;
    if (!seat && sections.length > 0) setSetupOpen(true);
  }, [seat, seatLoaded, sections.length]);

  const selectedSection = seat?.sectionId ?? "";

  const origin = useMemo(() => {
    if (seat) {
      const precise = resolveSeatLocation(seat.sectionId, seat.row, seat.seat);
      if (precise) return precise;
    }
    const match = sections.find((s) => s.id === selectedSection);
    return match?.location ?? venue?.center ?? null;
  }, [seat, sections, selectedSection, venue]);

  const filteredPois = useMemo(
    () => (filter === "all" ? pois : pois.filter((p) => p.type === filter)),
    [pois, filter]
  );

  const error = venueError ?? poiError;

  const sectionLabel =
    sections.find((s) => s.id === selectedSection)?.label ?? "Not set";
  const seatLabel = seat
    ? [seat.row && `Row ${seat.row.toUpperCase()}`, seat.seat && `Seat ${seat.seat}`]
        .filter(Boolean)
        .join(" · ") || "Section only"
    : "Tap to set seat";

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">StadiumFlow</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {venue ? venue.name : "Loading venue..."}
            </p>
          </div>
          <MatchTimer />
          <button
            onClick={() => setSetupOpen(true)}
            className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Edit your seat"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {sectionLabel}
            </span>
            <span className="text-sm">{seatLabel}</span>
            {seat && seat.partySize > 1 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
                ×{seat.partySize}
              </span>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {error.message}
        </div>
      )}

      <SuggestionBar pois={pois} origin={origin} />

      <section className="flex flex-1 flex-col lg:flex-row">
        <div className="min-h-[320px] flex-1 lg:min-h-0">
          <VenueMap
            venue={venue}
            pois={filteredPois}
            origin={origin}
            highlightedPoiIds={highlightedPoiIds}
          />
        </div>
        <aside
          className="w-full border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:w-96 lg:border-l lg:border-t-0"
          aria-label="Points of interest list"
        >
          <div className="mb-3 flex flex-wrap gap-1">
            {FILTER_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === t.value
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
                aria-pressed={filter === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
          <PoiList pois={filteredPois} origin={origin} />
        </aside>
      </section>

      <SeatSetup
        open={setupOpen}
        sections={sections}
        initial={seat}
        dismissible={!!seat}
        onClose={() => setSetupOpen(false)}
        onSave={(profile) => {
          saveSeat(profile);
          setSeat(profile);
          setSetupOpen(false);
        }}
      />

      <ProactiveAlerts
        venueId={venueId}
        sectionId={selectedSection}
        seat={seat}
        pois={pois}
        onHighlight={setHighlightedPoiIds}
      />
      <ChatPanel
        venueId={venueId}
        sectionId={selectedSection}
        seat={seat}
        pois={pois}
        onHighlight={setHighlightedPoiIds}
      />
    </main>
  );
}
