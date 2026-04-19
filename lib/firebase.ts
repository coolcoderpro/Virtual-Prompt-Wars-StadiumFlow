/**
 * Client-side Firebase initialization (browser).
 * Only uses NEXT_PUBLIC_* values, which are safe to expose.
 *
 * Exposes: Firestore, Auth, Analytics (lazy / SSR-safe), Performance.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (!config.projectId) {
    throw new Error(
      "Firebase config missing. Copy .env.local.example to .env.local and fill in the values."
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    // Eager anonymous sign-in: kicks off in parallel with the rest of boot so
    // Firestore subscriptions don't beat auth and trip the "missing or
    // insufficient permissions" rule check.
    if (typeof window !== "undefined" && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {
        // Anonymous provider not enabled in console — degrade silently; the
        // user can still use Google sign-in via AuthBadge.
      });
    }
  }
  return { app: app!, db: db!, auth: auth! };
}
