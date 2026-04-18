/**
 * Shared match-phase logic. Used by both the client (MatchTimer) and the
 * server (/api/chat) so the AI always agrees with what the fan sees.
 *
 * The demo loops a 180 sim-minute cycle. Each real second = 1.5 sim minutes.
 */

export type Phase =
  | "pre-match"
  | "first-half"
  | "half-time"
  | "second-half"
  | "full-time"
  | "exiting"
  | "venue-clear";

export interface MatchState {
  phase: Phase;
  label: string;
  /** Human-readable clock / countdown line. */
  clock: string;
  /** Sim minute inside the 0-180 cycle. */
  simMinute: number;
  /** 0-3 scale: how crowded the venue as a whole is right now. */
  venueBusyness: 0 | 1 | 2 | 3;
}

/** Deterministic cycle reference — everyone who imports this module agrees. */
const CYCLE_EPOCH = Date.UTC(2025, 0, 1, 0, 0, 0);
const SIM_SPEED = 1.5; // sim-min per real-second

export function simMinuteNow(now: number = Date.now()): number {
  const elapsedSeconds = (now - CYCLE_EPOCH) / 1000;
  const raw = elapsedSeconds * SIM_SPEED;
  return ((raw % 180) + 180) % 180;
}

export function phaseOf(m: number): Phase {
  if (m < 30) return "pre-match";
  if (m < 75) return "first-half";
  if (m < 90) return "half-time";
  if (m < 135) return "second-half";
  if (m < 140) return "full-time";
  if (m < 170) return "exiting";
  return "venue-clear";
}

export function busynessOf(phase: Phase): 0 | 1 | 2 | 3 {
  switch (phase) {
    case "pre-match":
      return 2;
    case "first-half":
    case "second-half":
      return 1;
    case "half-time":
      return 3;
    case "full-time":
    case "exiting":
      return 3;
    case "venue-clear":
      return 0;
  }
}

export function getMatchState(now: number = Date.now()): MatchState {
  const m = simMinuteNow(now);
  const phase = phaseOf(m);

  let label: string;
  let clock: string;

  switch (phase) {
    case "pre-match":
      label = "Pre-Match";
      clock = `Kick-off in ${Math.ceil(30 - m)} min`;
      break;
    case "first-half":
      label = "1st Half";
      clock = `${String(Math.floor(m - 30)).padStart(2, "0")}:00`;
      break;
    case "half-time":
      label = "Half-Time";
      clock = `${Math.ceil(90 - m)} min remaining`;
      break;
    case "second-half":
      label = "2nd Half";
      clock = `${String(Math.floor(m - 90) + 45).padStart(2, "0")}:00`;
      break;
    case "full-time":
      label = "Full-Time";
      clock = "Final whistle!";
      break;
    case "exiting": {
      const pctLeft = Math.round(((170 - m) / 30) * 100);
      label = "Fans Exiting";
      clock = `~${pctLeft}% still in venue`;
      break;
    }
    case "venue-clear":
      label = "Venue Clearing";
      clock = "Almost empty";
      break;
  }

  return { phase, label, clock, simMinute: m, venueBusyness: busynessOf(phase) };
}

/** Natural-language summary the AI can drop into its system prompt. */
export function phaseContextForAI(state: MatchState): string {
  switch (state.phase) {
    case "pre-match":
      return `It is PRE-MATCH (kick-off in ${Math.ceil(
        30 - state.simMinute
      )} minutes). Fans are arriving, gates are busy, concessions and merch picking up.`;
    case "first-half":
      return `The match is in the FIRST HALF (${state.clock}). Almost everyone is seated — concourses are quiet, this is the best time for amenities.`;
    case "half-time":
      return `It is HALF-TIME (${state.clock}). Restrooms and concessions are in peak-demand: every minute matters.`;
    case "second-half":
      return `The match is in the SECOND HALF (${state.clock}). Fans are watching — concourses are quiet but will spike at full-time.`;
    case "full-time":
      return `FULL-TIME whistle just blew. The exit rush is about to start. Gates will be packed within 2-3 minutes.`;
    case "exiting":
      return `Fans are EXITING (${state.clock}). Gates are crowded; suggesting "wait 10 minutes" is often faster than joining the crush.`;
    case "venue-clear":
      return `The venue is clearing out. Most amenities are quiet and most gates are walkable.`;
  }
}
