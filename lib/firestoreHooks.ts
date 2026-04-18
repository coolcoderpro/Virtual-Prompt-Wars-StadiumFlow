"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFirebase } from "./firebase";
import type { Poi, Section, Venue } from "./types";

export function useVenue(venueId: string) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const { db } = getFirebase();
      const ref = doc(db, "venues", venueId);
      return onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setVenue(null);
            return;
          }
          setVenue({ id: snap.id, ...(snap.data() as Omit<Venue, "id">) });
        },
        setError
      );
    } catch (err) {
      setError(err as Error);
    }
  }, [venueId]);

  return { venue, error };
}

export function usePois(venueId: string) {
  const [pois, setPois] = useState<Poi[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const { db } = getFirebase();
      const ref = collection(db, "venues", venueId, "pois");
      return onSnapshot(
        ref,
        (snap) => {
          setPois(
            snap.docs.map(
              (d) => ({ id: d.id, ...(d.data() as Omit<Poi, "id">) })
            )
          );
        },
        setError
      );
    } catch (err) {
      setError(err as Error);
    }
  }, [venueId]);

  return { pois, error };
}

export function useSections(venueId: string) {
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const { db } = getFirebase();
      const ref = collection(db, "venues", venueId, "sections");
      return onSnapshot(
        ref,
        (snap) => {
          setSections(
            snap.docs.map(
              (d) => ({ id: d.id, ...(d.data() as Omit<Section, "id">) })
            )
          );
        },
        setError
      );
    } catch (err) {
      setError(err as Error);
    }
  }, [venueId]);

  return { sections, error };
}
