import type { CsvRowError } from "@/app/_ports/ports";
import { MAX_JSON_LENGTH, type TimeWindows } from "./time/time-windows";

/** The largest CSV file the UI sends (UI-8, working assumption): 1 MB, counted as 1 048 576 bytes. */
export const MAX_CSV_BYTES = 1_048_576;
/** `is_valid_time_windows()` allows 1–50 periods. */
export const MAX_PERIODS = 50;

/** Why a chosen file is not sent to the backend, or null if it is (US-008). */
export function csvFileProblem(file: { name: string; size: number }): "not_csv" | "too_large" | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "not_csv";
  return file.size > MAX_CSV_BYTES ? "too_large" : null;
}

/** The CSV upload inside Composing (docs/automata/search-journey.md): NoFile, Checking, Accepted, Rejected. */
export type CsvState =
  | { state: "none" }
  | { state: "checking"; name: string }
  | { state: "accepted"; name: string; rows: number; windows: TimeWindows }
  | { state: "rejected"; name: string; errors: CsvRowError[] };

export const NO_CSV: CsvState = { state: "none" };

/** The candidate times a search can send, or why it cannot send any yet. */
export type CandidateTimes =
  | { ok: true; windows: TimeWindows; csvFilename: string | null }
  | { ok: false; issue: "missing" | "checking" | "manual_invalid" | "too_large" };

/**
 * The candidate times to send (1.2, 1.4): an accepted CSV file's periods, after the manual ones
 * when they are used together, otherwise the manual ones (US-008). A file being checked holds the
 * search back; a rejected file is not used. `manual` is null while the manual input has problems.
 */
export function candidateTimes(manual: TimeWindows | null, csv: CsvState, together: boolean): CandidateTimes {
  if (csv.state === "checking") return { ok: false, issue: "checking" };
  let windows: TimeWindows | null = manual;
  let csvFilename: string | null = null;
  if (csv.state === "accepted") {
    if (together && !manual) return { ok: false, issue: "manual_invalid" };
    windows = together && manual ? [...manual, ...csv.windows] : csv.windows;
    csvFilename = csv.name;
  }
  if (!windows) return { ok: false, issue: "missing" };
  if (windows.length > MAX_PERIODS || JSON.stringify(windows).length > MAX_JSON_LENGTH) {
    return { ok: false, issue: "too_large" };
  }
  return { ok: true, windows, csvFilename };
}
