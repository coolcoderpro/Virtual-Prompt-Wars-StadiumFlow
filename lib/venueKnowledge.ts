/**
 * Static venue knowledge that the AI needs but is not in Firestore:
 * menus, accessibility notes, gate-section affinity, ops guidance.
 *
 * Keep this concise — every character ships to Gemini on every chat turn.
 */

export interface PoiMeta {
  /** Which sections this POI primarily serves. */
  servesSections?: string[];
  /** Step-free / accessible? */
  accessible?: boolean;
  /** Menu or features (concessions, merch). */
  features?: string[];
  /** Extra operational notes the AI can cite. */
  notes?: string;
}

export const POI_META: Record<string, PoiMeta> = {
  // Gates — fans are funnelled to the one closest to their section.
  "gate-a": { servesSections: ["north-lower"], accessible: true, notes: "Main family entrance; step-free." },
  "gate-b": { servesSections: ["east-lower"],  accessible: false, notes: "Busy home-end gate on derby days." },
  "gate-c": { servesSections: ["south-lower"], accessible: true,  notes: "Closest to the tube station — packed after full-time." },
  "gate-d": { servesSections: ["west-lower", "club-wembley"], accessible: true, notes: "Quieter exit; adds ~90 m walk but clears faster." },

  // Restrooms
  "wc-n1": { servesSections: ["north-lower"], accessible: true,  features: ["baby-change"] },
  "wc-n2": { servesSections: ["north-lower"], accessible: false },
  "wc-s1": { servesSections: ["south-lower"], accessible: true },
  "wc-e1": { servesSections: ["east-lower"],  accessible: false, notes: "Gets overwhelmed at half-time — steer fans to W1 or N1." },
  "wc-w1": { servesSections: ["west-lower", "club-wembley"], accessible: true, features: ["baby-change"] },

  // Concessions
  "food-n": { servesSections: ["north-lower"], features: ["pies", "beer", "vegetarian"] },
  "food-s": { servesSections: ["south-lower"], features: ["hot-dogs", "beer", "halal-chicken"] },
  "food-e": { servesSections: ["east-lower"],  features: ["craft-beer", "loaded-fries"], notes: "Popular, always the first to queue up." },
  "food-w": { servesSections: ["west-lower", "club-wembley"], features: ["pies", "vegan-pie", "coffee"] },

  // Others
  "merch-main": { accessible: true, features: ["shirts", "scarves", "kids"] },
  "first-aid":  { accessible: true, notes: "Staffed every match; also handles lost-and-found." },
};

/** Quick reverse index: which POIs serve a given section. */
export function poisForSection(sectionId: string): string[] {
  return Object.entries(POI_META)
    .filter(([, meta]) => meta.servesSections?.includes(sectionId))
    .map(([id]) => id);
}

/**
 * The "persona" block: who the AI is, what it knows about the venue overall,
 * and what rules it must follow. Kept short and prescriptive.
 */
export const VENUE_SYSTEM_PROMPT = `
You are the StadiumFlow Assistant for Wembley Stadium (90,000 capacity).
You help fans in real time during a match day. You have live access to every
restroom, concession, gate, merch shop, and first-aid point in the venue,
updated every 5 seconds.

HOW TO ANSWER
- Be concise: 1-3 short sentences, never a wall of text.
- When you recommend a specific place, ALWAYS name it exactly as it appears
  in the live data (e.g. "Restroom W1", "Gate D") so the app can highlight it
  on the map.
- Quote concrete numbers: wait minutes, walking distance in metres,
  crowd level (Clear / Moderate / Busy / Packed).
- If the fan has selected a section, factor in walking distance from there.
- If a question isn't about the venue, politely redirect.

DECISION GUIDANCE
- At half-time, prefer the quietest option even if it is ~50 m further.
  Saving 5 minutes of queueing is worth a short walk.
- For exits, a "wait 10 minutes then leave through Gate D" answer is often
  better than sending someone into a packed gate now.
- Accessibility: if the fan mentions wheelchair, pram, step-free, elderly,
  ONLY recommend POIs flagged accessible.
- Dietary: match the fan's request (veggie / halal / vegan) to features.
- First aid is urgent — if the fan mentions faint, hurt, allergy, bleeding,
  IMMEDIATELY give the First Aid Point location and add "call a steward".
`.trim();
