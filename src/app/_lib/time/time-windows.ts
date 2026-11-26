import {
  tallinnDay,
  tallinnToUtc,
  type LocalDate,
  type LocalTime,
  type UtcInstant,
} from "./tallinn";

/**
 * The JSON shape of `searches.time_windows` (docs/data-model.md 5.4): period →
 * day → range → slot. Kept in the frontend until a shared file exists (#26).
 */
export type Interval = { start: UtcInstant; end: UtcInstant };
export type Slot = Interval;
export type Range = Interval & { slots?: Slot[] };
export type Day = Interval & { ranges: Range[] };
export type Period = Interval & { source: "tool" | "csv"; days: Day[] };
export type TimeWindows = Period[];

/** What the time-window tool holds: local dates and wall-clock times. */
export type DraftRange = { start: LocalTime; end: LocalTime };
export type DraftDay = { date: LocalDate; ranges: DraftRange[] };

/** Limits of `is_valid_time_windows()` and `searches.duration_minutes`. */
export const MAX_DAYS = 200;
export const MAX_RANGES_PER_DAY = 200;
export const MIN_DURATION = 5;
export const MAX_DURATION = 1440;
/**
 * The table allows 262 144 bytes of jsonb text, which is about 5 % longer than
 * JSON.stringify (a space after every ":" and ","), so stop well below it.
 */
export const MAX_JSON_LENGTH = 240_000;

type RangeProblem =
  | "invalid_time"
  | "nonexistent_time"
  | "end_not_after_start"
  | "shorter_than_duration";

/** Why the input cannot be sent; `day` and `range` are indexes into the input. */
export type DraftIssue =
  | { code: "no_days" | "too_many_days" | "invalid_duration" | "too_large" }
  | { code: "invalid_date" | "duplicate_date" | "no_ranges" | "too_many_ranges"; day: number }
  | { code: RangeProblem; day: number; range: number };

export type Built = { ok: true; windows: TimeWindows } | { ok: false; issues: DraftIssue[] };

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const byStart = (a: Interval, b: Interval) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

function toRange(date: LocalDate, draft: DraftRange, durationMinutes: number): Range | RangeProblem {
  if (draft.start === "24:00") return "invalid_time";
  const start = tallinnToUtc(date, draft.start);
  const end = tallinnToUtc(date, draft.end);
  if (!start.ok || !end.ok) {
    const invalid = (!start.ok && start.reason === "invalid") || (!end.ok && end.reason === "invalid");
    return invalid ? "invalid_time" : "nonexistent_time";
  }
  // Measured as UTC instants: 02:00–05:00 on 29 March 2026 is 2 hours.
  const minutes = (Date.parse(end.instant) - Date.parse(start.instant)) / 60_000;
  if (minutes <= 0) return "end_not_after_start";
  // A range must fit the whole event: #17 Unconfirmed decisions, UI-10.
  if (minutes < durationMinutes) return "shorter_than_duration";
  return { start: start.instant, end: end.instant };
}

/**
 * Checks the tool input and builds `searches.time_windows` from it: one "tool"
 * period from the first day's start to the last day's end, with days and
 * ranges in time order. Overlapping ranges are kept as entered; the solver
 * takes their union (data model 5.4).
 */
export function buildTimeWindows(days: DraftDay[], durationMinutes: number): Built {
  const issues: DraftIssue[] = [];
  const durationOk =
    Number.isInteger(durationMinutes) &&
    durationMinutes >= MIN_DURATION &&
    durationMinutes <= MAX_DURATION;
  if (!durationOk) issues.push({ code: "invalid_duration" });
  // With no valid duration, only the ranges' own order is checked.
  const minimum = durationOk ? durationMinutes : 0;
  if (days.length === 0) issues.push({ code: "no_days" });
  if (days.length > MAX_DAYS) issues.push({ code: "too_many_days" });

  const seen = new Set<LocalDate>();
  const built: Day[] = [];
  days.forEach((draft, day) => {
    const bounds = tallinnDay(draft.date);
    if (!bounds) {
      issues.push({ code: "invalid_date", day });
      return;
    }
    if (seen.has(draft.date)) issues.push({ code: "duplicate_date", day });
    seen.add(draft.date);
    if (draft.ranges.length === 0) issues.push({ code: "no_ranges", day });
    if (draft.ranges.length > MAX_RANGES_PER_DAY) issues.push({ code: "too_many_ranges", day });

    const ranges: Range[] = [];
    draft.ranges.forEach((range, index) => {
      const result = toRange(draft.date, range, minimum);
      if (typeof result === "string") issues.push({ code: result, day, range: index });
      else ranges.push(result);
    });
    built.push({ ...bounds, ranges: ranges.sort(byStart) });
  });

  if (issues.length > 0) return { ok: false, issues };
  built.sort(byStart);
  const windows: TimeWindows = [
    { source: "tool", start: built[0].start, end: built[built.length - 1].end, days: built },
  ];
  if (JSON.stringify(windows).length > MAX_JSON_LENGTH) {
    return { ok: false, issues: [{ code: "too_large" }] };
  }
  return { ok: true, windows };
}

/**
 * The input's dates that are in the next semester: the local day starts at or
 * after `semesterStart`, the UTC instant the semester begins. Sorted, without
 * repeats.
 */
export function datesInNextSemester(days: DraftDay[], semesterStart: UtcInstant): LocalDate[] {
  if (!UTC_INSTANT.test(semesterStart)) throw new RangeError(`Not a UTC instant: ${semesterStart}`);
  const dates = days
    .map((day) => day.date)
    .filter((date) => {
      const bounds = tallinnDay(date);
      return bounds !== null && bounds.start >= semesterStart;
    });
  return [...new Set(dates)].sort();
}
