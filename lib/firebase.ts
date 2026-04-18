/**
 * Client-side Firebase initialization (browser).
 * Only uses NEXT_PUBLIC_* values, which are safe to expose.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebase(): { app: FirebaseApp; db: Firestore } {
  if (!config.projectId) {
    throw new Error(
      "Firebase config missing. Copy .env.local.example to .env.local and fill in the values."
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    db = getFirestore(app);
  }
  return { app: app!, db: db! };
}
