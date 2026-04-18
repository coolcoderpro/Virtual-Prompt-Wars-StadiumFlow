"use client";

import { useState } from "react";
import { usePois } from "@/lib/firestoreHooks";
import { CROWD_LABELS } from "@/lib/crowd";
import type { CrowdLevel } from "@/lib/types";

const VENUE_ID = "wembley";

export default function AdminPage() {
  const { pois } = usePois(VENUE_ID);
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<string>("");

  async function update(poiId: string, crowdLevel: CrowdLevel, waitMinutes: number) {
    if (!passcode) {
      setStatus("Enter the admin passcode first.");
      return;
    }
    setStatus(`Updating ${poiId}...`);
    const res = await fetch("/api/admin/poi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-passcode": passcode,
      },
      body: JSON.stringify({ venueId: VENUE_ID, poiId, crowdLevel, waitMinutes }),
    });
    if (res.ok) {
      setStatus(`Updated ${poiId}.`);
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.error ?? res.statusText}`);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Admin overrides</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Manually set crowd level and wait time for any POI. Writes are gated by
        a passcode on the server.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <span>Passcode</span>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          aria-label="Admin passcode"
        />
      </label>

      {status && (
        <div
          role="status"
          className="mb-4 rounded border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {status}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">POI</th>
            <th className="p-2">Type</th>
            <th className="p-2">Crowd</th>
            <th className="p-2">Wait (min)</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {pois.map((p) => (
            <AdminRow
              key={p.id}
              name={p.name}
              type={p.type}
              initialCrowd={p.crowdLevel}
              initialWait={p.waitMinutes}
              onSave={(c, w) => update(p.id, c, w)}
            />
          ))}
        </tbody>
      </table>
    </main>
  );
}

function AdminRow({
  name,
  type,
  initialCrowd,
  initialWait,
  onSave,
}: {
  name: string;
  type: string;
  initialCrowd: CrowdLevel;
  initialWait: number;
  onSave: (c: CrowdLevel, w: number) => void;
}) {
  const [crowd, setCrowd] = useState<CrowdLevel>(initialCrowd);
  const [wait, setWait] = useState<number>(initialWait);

  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="p-2 font-medium">{name}</td>
      <td className="p-2 text-slate-500">{type}</td>
      <td className="p-2">
        <select
          value={crowd}
          onChange={(e) => setCrowd(Number(e.target.value) as CrowdLevel)}
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          aria-label={`Crowd level for ${name}`}
        >
          {([-1, 0, 1, 2, 3] as CrowdLevel[]).map((c) => (
            <option key={c} value={c}>
              {CROWD_LABELS[c]}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <input
          type="number"
          min={0}
          max={180}
          value={wait}
          onChange={(e) => setWait(Number(e.target.value))}
          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          aria-label={`Wait minutes for ${name}`}
        />
      </td>
      <td className="p-2">
        <button
          onClick={() => onSave(crowd, wait)}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
