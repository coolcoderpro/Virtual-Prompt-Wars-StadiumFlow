/**
 * Thin wrapper around Firebase Analytics.
 *
 * - SSR-safe: every call is a no-op outside the browser.
 * - Resilient: if Analytics isn't supported (e.g. unsupported browser, no
 *   measurementId in env), `track()` becomes a no-op rather than throwing.
 * - Centralised event names to keep Looker dashboards consistent.
 */

import { isSupported, getAnalytics, logEvent, type Analytics } from "firebase/analytics";
import { getFirebase } from "./firebase";

export type AnalyticsEvent =
  | "chat_send"
  | "chat_response"
  | "chat_error"
  | "quick_prompt_click"
  | "poi_highlight"
  | "phase_transition"
  | "proactive_alert"
  | "seat_saved"
  | "auth_google_sign_in"
  | "auth_sign_out"
  | "filter_change";

let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        if (!(await isSupported())) return null;
        const { app } = getFirebase();
        return getAnalytics(app);
      } catch {
        return null;
      }
    })();
  }
  return analyticsPromise;
}

export function track(event: AnalyticsEvent, params?: Record<string, unknown>): void {
  // Fire and forget — never block UI on analytics.
  void getAnalyticsInstance().then((a) => {
    if (!a) return;
    try {
      logEvent(a, event, params as Record<string, string | number | boolean>);
    } catch {
      // Swallow — analytics must never break the app.
    }
  });
}
