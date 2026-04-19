"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebase } from "./firebase";
import type { Poi, Section, Venue } from "./types";

/**
 * Subscribe to a Firestore source only after Firebase Auth has resolved a
 * user. The new Firestore rules require `request.auth != null`, so calling
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

export function useVenue(venueId: string) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useAuthedSnapshot(() => {
    const { db } = getFirebase();
    const ref = doc(db, "venues", venueId);
    return onSnapshot(
      ref,
      (snap) => {
        setError(null);
        if (!snap.exists()) {
          setVenue(null);
          return;
        }
        setVenue({ id: snap.id, ...(snap.data() as Omit<Venue, "id">) });
      },
      setError
    );
  }, [venueId]);

  return { venue, error };
}

export function usePois(venueId: string) {
  const [pois, setPois] = useState<Poi[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useAuthedSnapshot(() => {
    const { db } = getFirebase();
    const ref = collection(db, "venues", venueId, "pois");
    return onSnapshot(
      ref,
      (snap) => {
        setError(null);
        setPois(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<Poi, "id">) })
          )
        );
      },
      setError
    );
  }, [venueId]);

  return { pois, error };
}

export function useSections(venueId: string) {
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useAuthedSnapshot(() => {
    const { db } = getFirebase();
    const ref = collection(db, "venues", venueId, "sections");
    return onSnapshot(
      ref,
      (snap) => {
        setError(null);
        setSections(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<Section, "id">) })
          )
        );
      },
      setError
    );
  }, [venueId]);

  return { sections, error };
}
