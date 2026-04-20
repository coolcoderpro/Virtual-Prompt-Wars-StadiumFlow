"use client";

import { useState } from "react";
import { signInWithGoogle, signOut, useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";

/**
 * Compact auth chip rendered in the dashboard header.
 *
 * - Anonymous users see "Sign in with Google" — the click upgrades the
 *   anonymous account so their seat profile carries over.
 * - Signed-in Google users see their initial + a sign-out menu.
 */
export default function AuthBadge() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <span
        className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        aria-live="polite"
      >
        …
      </span>
    );
  }

  const isGoogleUser = !!user && !user.isAnonymous;

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const u = await signInWithGoogle();
      track("auth_google_sign_in", { uid: u.uid });
    } catch (err) {
      const message = (err as Error).message || "Sign-in failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      track("auth_sign_out");
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!isGoogleUser) {
    return (
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Sign in with Google"
        >
          <GoogleGlyph />
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && (
          <span className="mt-1 text-[10px] text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    );
  }

  const initial =
    user?.displayName?.charAt(0).toUpperCase() ??
    user?.email?.charAt(0).toUpperCase() ??
    "U";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Account menu for ${user?.displayName ?? user?.email ?? "user"}`}
      >
        {initial}
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
              {user?.displayName ?? "Signed in"}
            </p>
            <p className="truncate">{user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
