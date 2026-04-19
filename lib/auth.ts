/**
 * Firebase Authentication helpers.
 *
 * Default: every visitor is signed in anonymously so Firestore reads have a
 * stable uid we can attach analytics events to and lock down rules with.
 * Optional: upgrade the anonymous account to a Google account so the user
 * can roam between devices and we get a real identity for analytics.
 */
"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getFirebase } from "./firebase";

export interface AuthState {
  user: User | null;
  /** True until the first onAuthStateChanged tick fires. */
  loading: boolean;
}

let ensuredAnon = false;

async function ensureAnonymous() {
  if (ensuredAnon) return;
  ensuredAnon = true;
  const { auth } = getFirebase();
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch {
      // Anonymous auth not enabled in the Firebase project — degrade silently.
      ensuredAnon = false;
    }
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const { auth } = getFirebase();
      unsub = onAuthStateChanged(auth, (user) => {
        setState({ user, loading: false });
        if (!user) void ensureAnonymous();
      });
    } catch {
      setState({ user: null, loading: false });
    }
    return () => unsub?.();
  }, []);

  return state;
}

/**
 * Upgrade an anonymous account to a Google account, or sign in fresh.
 * Falls back to a regular sign-in if linking fails (e.g. the Google account
 * is already in use elsewhere).
 */
export async function signInWithGoogle(): Promise<User> {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      const result = await linkWithPopup(current, provider);
      return result.user;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "auth/credential-already-in-use") throw err;
      // Fall through to a plain sign-in.
    }
  }
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  const { auth } = getFirebase();
  await fbSignOut(auth);
  ensuredAnon = false;
}
