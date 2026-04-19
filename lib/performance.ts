/**
 * Firebase Performance Monitoring helpers.
 *
 * `tracedFetch` wraps a fetch in a custom trace so /api/chat round-trip
 * latency lands in the Firebase console alongside the auto-collected
 * page-load and HTTP traces.
 */

import { getPerformance, trace, type FirebasePerformance } from "firebase/performance";
import { getFirebase } from "./firebase";

let perf: FirebasePerformance | null = null;
let perfTried = false;

function getPerf(): FirebasePerformance | null {
  if (typeof window === "undefined") return null;
  if (perfTried) return perf;
  perfTried = true;
  try {
    const { app } = getFirebase();
    perf = getPerformance(app);
  } catch {
    perf = null;
  }
  return perf;
}

/** Initialise Performance Monitoring once the app boots. Safe to call repeatedly. */
export function ensurePerformance(): void {
  getPerf();
}

/**
 * Run a fetch wrapped in a Firebase Performance custom trace.
 * Records duration plus a `status` and `ok` attribute for the response.
 */
export async function tracedFetch(
  name: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const p = getPerf();
  if (!p) return fetch(input, init);
  const t = trace(p, name);
  t.start();
  try {
    const res = await fetch(input, init);
    t.putAttribute("status", String(res.status));
    t.putAttribute("ok", String(res.ok));
    return res;
  } finally {
    t.stop();
  }
}
