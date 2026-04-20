/**
 * Typed React hooks over Firestore `onSnapshot`, scoped to the current
 * authenticated user.
 *
 * `useAuthedDoc` and `useAuthedCollection` are private generics that
 * handle the two common shapes (single document, collection). The three
 * exported hooks (`useVenue`, `usePois`, `useSections`) are thin wrappers
 * with the domain types plugged in — adding a fourth collection is a
 * one-line hook.
 */
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  type DocumentReference,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebase } from "./firebase";
import type { Poi, Section, Venue } from "./types";

/**
 * Subscribe to a Firestore source only after Firebase Auth has resolved a
 * user. The Firestore rules require `request.auth != null`, so calling
 * onSnapshot before anonymous sign-in finishes throws "missing or
 * insufficient permissions" until auth catches up.
 */
function useAuthedSnapshot(subscribe: () => Unsubscribe, deps: unknown[]) {
  useEffect(() => {
    const { auth } = getFirebase();
    let active = true;
    let unsubSnap: Unsubscribe | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      // Tear down any previous subscription when auth state changes (e.g.
      // anonymous → Google sign-in) so the new identity is what's reading.
      unsubSnap?.();
      unsubSnap = undefined;
      if (user) unsubSnap = subscribe();
    });

    return () => {
      active = false;
      unsubAuth();
      unsubSnap?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type WithId<T> = T & { id: string };

function useAuthedDoc<T>(
  makeRef: () => DocumentReference,
  deps: unknown[]
): { data: WithId<T> | null; error: Error | null } {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useAuthedSnapshot(
    () =>
      onSnapshot(
        makeRef(),
        (snap) => {
          setError(null);
          if (!snap.exists()) {
            setData(null);
            return;
          }
          setData({ id: snap.id, ...(snap.data() as T) });
        },
        setError
      ),
    deps
  );

  return { data, error };
}

function useAuthedCollection<T>(
  makeRef: () => Query,
  deps: unknown[]
): { data: WithId<T>[]; error: Error | null } {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useAuthedSnapshot(
    () =>
      onSnapshot(
        makeRef(),
        (snap) => {
          setError(null);
          setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        },
        setError
      ),
    deps
  );

  return { data, error };
}

export function useVenue(venueId: string) {
  const { data, error } = useAuthedDoc<Omit<Venue, "id">>(
    () => doc(getFirebase().db, "venues", venueId),
    [venueId]
  );
  return { venue: data as Venue | null, error };
}

export function usePois(venueId: string) {
  const { data, error } = useAuthedCollection<Omit<Poi, "id">>(
    () => collection(getFirebase().db, "venues", venueId, "pois"),
    [venueId]
  );
  return { pois: data as Poi[], error };
}

export function useSections(venueId: string) {
  const { data, error } = useAuthedCollection<Omit<Section, "id">>(
    () => collection(getFirebase().db, "venues", venueId, "sections"),
    [venueId]
  );
  return { sections: data as Section[], error };
}
