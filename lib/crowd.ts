/**
 * Presentation tokens for each `CrowdLevel`. Colours track tailwind.config.ts
 * and icons are deliberately text-only so the signal is readable without
 * colour (accessibility).
 */
import type { CrowdLevel } from "./types";

export const CROWD_LABELS: Record<CrowdLevel, string> = {
  [-1]: "Unknown",
  0: "Clear",
  1: "Moderate",
  2: "Busy",
  3: "Packed",
};

/** Tailwind colour tokens (see tailwind.config.ts). */
export const CROWD_COLORS: Record<CrowdLevel, string> = {
  [-1]: "bg-crowd-unknown",
  0: "bg-crowd-clear",
  1: "bg-crowd-moderate",
  2: "bg-crowd-busy",
  3: "bg-crowd-packed",
};

/** Iconography chosen so state is readable without colour (accessibility). */
export const CROWD_ICONS: Record<CrowdLevel, string> = {
  [-1]: "?",
  0: "o",
  1: "~",
  2: "!",
  3: "x",
};
