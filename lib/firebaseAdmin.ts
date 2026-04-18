/**
 * Server-side Firebase Admin initialization.
 * Never import this from client components. It relies on a service account.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let db: Firestore | null = null;

function loadCredential() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    const absolute = resolve(process.cwd(), saPath);
    const json = JSON.parse(readFileSync(absolute, "utf8"));
    return cert(json);
  }
  // Fallback: GOOGLE_APPLICATION_CREDENTIALS env or metadata server.
  return applicationDefault();
}

export function getAdmin(): { app: App; db: Firestore } {
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        credential: loadCredential(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    db = getFirestore(app);
  }
  return { app: app!, db: db! };
}
