import type { Complexity } from "@/app/_ports/ports";
import { decimal } from "./format";

/** The weights of a search (`searches.complexity_weights`, data model 5.3): 1 = no penalty, 0 = avoid. */
export type ComplexityWeights = Record<Complexity, number>;

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  google_form: "Google Form",
  contact_owner: "Omanikule kirjutada",
  institute_permission: "Instituudi luba",
  university_permission: "Ülikooli luba",
  other: "Muu",
};

/** How to book a room of each class, shown with the result (frame 07). */
export const BOOKING_HINTS: Record<Complexity, string> = {
  google_form: "seda ruumi saab broneerida Google Formi kaudu.",
  contact_owner: "kirjuta ruumi omanikule.",
  institute_permission: "ruumi jaoks on vaja instituudi luba.",
  university_permission: "ruumi jaoks on vaja ülikooli luba.",
  other: "uuri broneerimise viisi ruumi haldajalt.",
};

/** The classes in the order of the mockup: easiest to get first. */
export const COMPLEXITY_ORDER: Complexity[] = [
  "google_form",
  "contact_owner",
  "institute_permission",
  "university_permission",
  "other",
];

// PLACEHOLDER(#22): the default weights of data model 5.3, until the matching decides them (Q3).
export const DEFAULT_WEIGHTS: ComplexityWeights = {
  google_form: 1,
  contact_owner: 0.7,
  institute_permission: 0.6,
  university_permission: 0.4,
  other: 0.3,
};

/** Reads a typed weight such as "0,456" or "0.7": rounded to 2 decimals and kept within 0–1; null if not a number. */
export function readWeight(text: string): number | null {
  const normalised = text.trim().replace(",", ".").replace("−", "-");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalised)) return null;
  // Shift the decimal point in the text, so 0,145 rounds up to 0,15 like Postgres round().
  const rounded = Math.round(Number(`${normalised}e2`)) / 100;
  return Math.min(1, Math.max(0, rounded)) + 0; // + 0 turns -0 into 0
}

/** A weight for display: 0.7 → "0,70". */
export const formatWeight = decimal;

/** Only the weights that differ from the defaults; a missing key means the default (data model 5.3). */
export function changedWeights(weights: ComplexityWeights): Partial<ComplexityWeights> {
  return Object.fromEntries(
    COMPLEXITY_ORDER.filter((c) => weights[c] !== DEFAULT_WEIGHTS[c]).map((c) => [c, weights[c]]),
  );
}
