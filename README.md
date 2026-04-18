# StadiumFlow

Smart venue companion for large sporting events. Web-only MVP using Next.js, Firebase Firestore and Google Maps.

## What it does (MVP)
- Live map of Wembley Stadium with colour-coded crowd density at gates, restrooms, concessions and more.
- Filterable POI list with distances from a user-picked seating section.
- Smart suggestions: nearest *clear* restroom / concession / exit gate.
- Admin override page for live demos.
- Dummy data fed by a local simulator (real CV/Wi-Fi integrations can plug in later).

## Tech
Next.js 15 (App Router) + TypeScript + Tailwind + Firebase Firestore + Google Maps JS API.

---

## Phase 0: One-time setup

### 1. Create Google Cloud / Firebase project
1. Go to https://console.firebase.google.com and create a new project (e.g. `stadiumflow`).
2. In the Firebase console, open **Build -> Firestore Database -> Create database** (start in production mode, any region).
3. Open **Build -> Hosting -> Get started** (you can skip the CLI steps there; we already have `firebase.json`).
4. Go to **Project settings -> General -> Your apps -> Web app** and register a web app. Copy the Firebase config values.

### 2. Create a Google Maps API key
1. In the Google Cloud console (same project), go to **APIs & Services -> Library** and enable:
   - Maps JavaScript API
2. Go to **APIs & Services -> Credentials -> Create credentials -> API key**.
3. Restrict the key:
   - **Application restriction**: HTTP referrers -> add `http://localhost:3000/*` and your deployed domain later.
   - **API restriction**: Maps JavaScript API only.

### 3. Create a service account (for seed + simulator + admin API)
1. In the Cloud console, go to **IAM & Admin -> Service Accounts -> Create service account**.
2. Grant it the role **Cloud Datastore User** (or **Firebase Admin** if you prefer).
3. Create a JSON key and download it. Save it to the project root as `service-account.json` (already git-ignored).

### 4. Install tooling
- Node.js 20+ (you have 22, great).
- `npm i -g firebase-tools` then `firebase login`.

---

## Phase 1: Local run

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.local.example .env.local
# then fill in NEXT_PUBLIC_MAPS_KEY, NEXT_PUBLIC_FIREBASE_*, and ADMIN_PASSCODE

# 3. Seed the venue
npm run seed

# 4. (in a separate terminal) keep data moving
npm run simulate

# 5. Run the app
npm run dev
```

Open http://localhost:3000 for the main view and http://localhost:3000/admin for the overrides page.

## Tests
```bash
npm test
```

## Deploy
```bash
npm run build
firebase deploy --only firestore:rules,hosting
```
(Note: static hosting works for the public pages; `/admin` and `/api/admin/poi` require a Node environment — deploy those to Cloud Run / Cloud Functions / Vercel if you want the full feature set in production.)

## Project layout
```
app/            Next.js routes (main dashboard, admin page, admin API)
components/    Dashboard, VenueMap, PoiList, PoiCard, SuggestionBar
lib/           Shared types, Firebase clients, suggestion logic, hooks
scripts/       seed.ts, simulate.ts
tests/         Vitest unit tests
```

## Security notes
- Firestore rules are **read-only** for clients. All writes go through `/api/admin/poi` which requires `ADMIN_PASSCODE`.
- Never commit `service-account.json` or `.env.local`.
- Restrict your Maps API key by referrer before deploying.

## What's next (post-MVP)
- Auth + per-user preferences
- Gemini-powered assistant grounded on venue data
- Real crowd sensing: Vertex AI Vision on a CCTV clip, or Wi-Fi analytics feed
- Push notifications when a queue clears
- Group coordination / meet-up
