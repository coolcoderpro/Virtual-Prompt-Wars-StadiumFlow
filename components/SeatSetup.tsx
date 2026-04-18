"use client";

import { useEffect, useState } from "react";
import { getLayout } from "@/lib/seatLayout";
import type { Section } from "@/lib/types";
import type { SeatProfile } from "@/lib/seatStorage";

interface Props {
  open: boolean;
  sections: Section[];
  initial: SeatProfile | null;
  onSave: (profile: SeatProfile) => void;
  onClose: () => void;
  /** Whether dismissing without saving is allowed (false on first visit). */
  dismissible: boolean;
}

export default function SeatSetup({
  open,
  sections,
  initial,
  onSave,
  onClose,
  dismissible,
}: Props) {
  const [sectionId, setSectionId] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSectionId(initial?.sectionId ?? sections[0]?.id ?? "");
    setRow(initial?.row ?? "");
    setSeat(initial?.seat ?? "");
    setPartySize(initial?.partySize ?? 1);
    setHasAccess(initial?.hasAccessibilityNeeds ?? false);
  }, [open, initial, sections]);

  const layout = getLayout(sectionId);

  // If the user switches section, clamp row/seat to what that section supports.
  useEffect(() => {
    if (!layout) return;
    if (row && !layout.rows.includes(row)) setRow("");
    const seatNum = Number.parseInt(seat, 10);
    if (seat && (!Number.isFinite(seatNum) || seatNum > layout.seatsPerRow)) {
      setSeat("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  if (!open) return null;

  const canSave = sectionId.length > 0 && partySize >= 1 && partySize <= 20;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tell us where you're sitting"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Where are you sitting?</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          So the assistant can find amenities closest to your seat and size
          recommendations for your group.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            onSave({
              sectionId,
              row: row.trim() || undefined,
              seat: seat.trim() || undefined,
              partySize,
              hasAccessibilityNeeds: hasAccess || undefined,
            });
          }}
          className="mt-5 space-y-4"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Section</span>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              required
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Row</span>
              <select
                value={row}
                onChange={(e) => setRow(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                disabled={!layout}
              >
                <option value="">—</option>
                {layout?.rows.map((r) => (
                  <option key={r} value={r}>
                    Row {r}
                  </option>
                ))}
              </select>
              {layout && (
                <span className="mt-1 block text-[10px] text-slate-500">
                  A = pitch-side · {layout.rows[layout.rows.length - 1]} = back
                </span>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Seat</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={layout?.seatsPerRow ?? 999}
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                placeholder={layout ? `1 – ${layout.seatsPerRow}` : "e.g. 22"}
                className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                disabled={!layout}
              />
              {layout && (
                <span className="mt-1 block text-[10px] text-slate-500">
                  {layout.seatsPerRow} seats per row
                </span>
              )}
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Group size</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                className="h-8 w-8 rounded-full border border-slate-300 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                aria-label="Decrease group size"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) =>
                  setPartySize(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  )
                }
                className="w-16 rounded border border-slate-300 bg-white px-2 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                className="h-8 w-8 rounded-full border border-slate-300 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                aria-label="Increase group size"
              >
                +
              </button>
              <span className="text-xs text-slate-500">
                {partySize === 1 ? "just me" : `${partySize} people total`}
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasAccess}
              onChange={(e) => setHasAccess(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>
              We need step-free / accessible routes (wheelchair, pram, mobility)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Save seat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
