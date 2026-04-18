/**
 * Seed script: populates Firestore with Wembley Stadium and a set of POIs.
 * Usage:
 *   1. Put a service-account.json at the project root (or set FIREBASE_SERVICE_ACCOUNT_PATH)
 *   2. npm run seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { getAdmin } from "../lib/firebaseAdmin";
import type { Poi, Section, Venue } from "../lib/types";

const VENUE: Venue = {
  id: "wembley",
  name: "Wembley Stadium",
  center: { lat: 51.5560, lng: -0.2795 },
  zoom: 17,
};

// Approximate coordinates around the Wembley bowl. Good enough for a demo.
const SECTIONS: Section[] = [
  { id: "north-lower", label: "North Lower", location: { lat: 51.5568, lng: -0.2795 } },
  { id: "south-lower", label: "South Lower", location: { lat: 51.5552, lng: -0.2795 } },
  { id: "east-lower",  label: "East Lower",  location: { lat: 51.5560, lng: -0.2783 } },
  { id: "west-lower",  label: "West Lower",  location: { lat: 51.5560, lng: -0.2807 } },
  { id: "club-wembley", label: "Club Wembley", location: { lat: 51.5560, lng: -0.2795 } },
];

const POIS: Omit<Poi, "updatedAt">[] = [
  // Gates
  { id: "gate-a", name: "Gate A", type: "gate", location: { lat: 51.5575, lng: -0.2795 }, crowdLevel: 1, waitMinutes: 2 },
  { id: "gate-b", name: "Gate B", type: "gate", location: { lat: 51.5560, lng: -0.2775 }, crowdLevel: 2, waitMinutes: 5 },
  { id: "gate-c", name: "Gate C", type: "gate", location: { lat: 51.5545, lng: -0.2795 }, crowdLevel: 1, waitMinutes: 3 },
  { id: "gate-d", name: "Gate D", type: "gate", location: { lat: 51.5560, lng: -0.2815 }, crowdLevel: 0, waitMinutes: 1 },

  // Restrooms
  { id: "wc-n1", name: "Restroom N1", type: "restroom", location: { lat: 51.5569, lng: -0.2798 }, crowdLevel: 0, waitMinutes: 0 },
  { id: "wc-n2", name: "Restroom N2", type: "restroom", location: { lat: 51.5571, lng: -0.2790 }, crowdLevel: 2, waitMinutes: 4 },
  { id: "wc-s1", name: "Restroom S1", type: "restroom", location: { lat: 51.5551, lng: -0.2798 }, crowdLevel: 1, waitMinutes: 2 },
  { id: "wc-e1", name: "Restroom E1", type: "restroom", location: { lat: 51.5560, lng: -0.2780 }, crowdLevel: 3, waitMinutes: 8 },
  { id: "wc-w1", name: "Restroom W1", type: "restroom", location: { lat: 51.5560, lng: -0.2810 }, crowdLevel: 0, waitMinutes: 1 },

  // Concessions
  { id: "food-n", name: "North Concourse Food",  type: "concession", location: { lat: 51.5567, lng: -0.2793 }, crowdLevel: 2, waitMinutes: 6 },
  { id: "food-s", name: "South Concourse Food",  type: "concession", location: { lat: 51.5553, lng: -0.2793 }, crowdLevel: 1, waitMinutes: 3 },
  { id: "food-e", name: "East Beer & Bites",     type: "concession", location: { lat: 51.5560, lng: -0.2784 }, crowdLevel: 3, waitMinutes: 12 },
  { id: "food-w", name: "West Pie Stand",        type: "concession", location: { lat: 51.5560, lng: -0.2806 }, crowdLevel: 0, waitMinutes: 2 },

  // Merch + first aid (outside the pitch, in concourse areas)
  { id: "merch-main", name: "Main Merch Store", type: "merch", location: { lat: 51.5573, lng: -0.2803 }, crowdLevel: 2, waitMinutes: 5 },
  { id: "first-aid",  name: "First Aid Point",  type: "firstaid", location: { lat: 51.5549, lng: -0.2803 }, crowdLevel: 0, waitMinutes: 0 },
];

async function main() {
  const { db } = getAdmin();
  const now = Date.now();

  const venueRef = db.collection("venues").doc(VENUE.id);
  const { id: _vid, ...venueData } = VENUE;
  void _vid;
  await venueRef.set(venueData);

  const batch = db.batch();

  for (const s of SECTIONS) {
    const { id, ...data } = s;
    batch.set(venueRef.collection("sections").doc(id), data);
  }

  for (const p of POIS) {
    const { id, ...data } = p;
    batch.set(venueRef.collection("pois").doc(id), { ...data, updatedAt: now });
  }

  await batch.commit();
  // eslint-disable-next-line no-console
  console.log(
    `Seeded venue "${VENUE.name}" with ${SECTIONS.length} sections and ${POIS.length} POIs.`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
