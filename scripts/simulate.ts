/**
 * Simulator: models a real match-day.
 *
 * Match-day cycle (180 sim-minutes, loops cleanly):
 *   0–30   Pre-match: fans arriving through gates
 *   30–75  1st half:  everyone seated watching
 *   75–90  Half-time: fans rush to food & restrooms
 *   90–135 2nd half:  everyone back watching
 *   135–178 Post-match: fans exiting through gates
 *   178–180 Brief reset before next cycle
 *
 * IMPORTANT: Gates must stay >= 1.5 during the entire exit phase,
 * because the map uses gate crowd to infer stand fill:
 *   gates < 1.5 → stands full (match on)
 *   gates >= 1.5 → stands emptying (entering or exiting)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { getAdmin } from "../lib/firebaseAdmin";
import { simMinuteNow } from "../lib/matchPhase";
import type { CrowdLevel, Poi, PoiType } from "../lib/types";

const VENUE_ID = "wembley";
const TICK_MS = 5_000;

function baselineFor(type: PoiType, t: number): number {
  const m = ((t % 180) + 180) % 180;
  switch (type) {
    case "gate":
      // Gates busy = people moving (entering or exiting) = stands NOT full
      // Gates quiet = people seated = stands full
      if (m < 30) return 2.5;        // pre-match — fans streaming in
      if (m < 75) return 0.2;        // 1st half — gates quiet, everyone watching
      if (m < 90) return 0.2;        // half-time — no one leaves the venue, just their seats
      if (m < 135) return 0.2;       // 2nd half — gates quiet, everyone watching
      if (m < 140) return 1.8;       // full-time whistle — exit begins
      if (m < 155) return 3.0;       // peak exit — gates packed
      if (m < 165) return 2.5;       // still lots of people exiting
      if (m < 175) return 1.8;       // thinning but still busy
      return 1.5;                    // last few leaving (stays >= 1.5 so stands stay empty)
    case "restroom":
      if (m < 30) return 0.8;        // pre-match — some usage
      if (m < 75) return 0.3;        // 1st half — everyone watching
      if (m < 78) return 2.0;        // half-time starts — rush begins
      if (m < 88) return 3.0;        // half-time peak — restrooms PACKED
      if (m < 90) return 1.5;        // heading back to seats
      if (m < 135) return 0.3;       // 2nd half — watching
      if (m < 150) return 1.5;       // post-match — some usage on the way out
      return 0.2;                    // venue clearing
    case "concession":
      if (m < 30) return 1.5;        // pre-match — grab a snack
      if (m < 75) return 0.3;        // 1st half — watching
      if (m < 78) return 2.0;        // half-time starts — food rush
      if (m < 88) return 3.0;        // half-time peak — concessions PACKED
      if (m < 90) return 1.5;        // heading back
      if (m < 135) return 0.3;       // 2nd half — watching
      if (m < 150) return 0.8;       // post-match — some grab food leaving
      return 0.1;                    // venue clearing
    case "merch":
      if (m < 30) return 2.0;        // pre-match — buy scarves, shirts
      if (m < 75) return 0.3;        // 1st half — watching
      if (m < 90) return 0.8;        // half-time — browse
      if (m < 135) return 0.3;       // 2nd half — watching
      if (m < 155) return 2.5;       // post-match — souvenir rush
      if (m < 165) return 1.0;       // thinning
      return 0.2;                    // venue clearing
    case "firstaid":
      return 0.2;
  }
}

function clampCrowd(n: number): CrowdLevel {
  return Math.max(0, Math.min(3, Math.round(n))) as CrowdLevel;
}

function jitter(spread: number): number {
  return (Math.random() - 0.5) * spread;
}

async function tick() {
  const { db } = getAdmin();
  const minutes = simMinuteNow();

  const snap = await db.collection("venues").doc(VENUE_ID).collection("pois").get();

  const batch = db.batch();
  snap.forEach((doc) => {
    const p = doc.data() as Omit<Poi, "id">;
    const base = baselineFor(p.type, minutes);
    const crowdLevel = clampCrowd(base + jitter(0.6));
    const waitMinutes = Math.max(0, Math.round(crowdLevel * 3 + jitter(2)));
    batch.update(doc.ref, { crowdLevel, waitMinutes, updatedAt: Date.now() });
  });
  await batch.commit();

  const phase =
    minutes < 30 ? "pre-match" :
    minutes < 75 ? "1st-half" :
    minutes < 90 ? "half-time" :
    minutes < 135 ? "2nd-half" :
    minutes < 140 ? "full-time" :
    minutes < 170 ? "exiting" : "clearing";

  console.log(`[${phase}] sim-min=${minutes.toFixed(1)} updated=${snap.size}`);
}

async function main() {
  console.log(`Simulator running every ${TICK_MS / 1000}s. Ctrl+C to stop.`);
  console.log("Cycle: pre-match → 1st half → half-time → 2nd half → exit → clear → (loops)");

  await tick();
  setInterval(() => {
    tick().catch(console.error);
  }, TICK_MS);
}

main().catch((err) => { console.error(err); process.exit(1); });
