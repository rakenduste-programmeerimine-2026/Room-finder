/**
 * Europe/Tallinn wall-clock time <-> UTC, used only at the UI boundary.
 *
 * Built on Intl with an explicit time zone, so results never depend on the
 * system time zone (tests run in UTC, browsers in Tallinn). Decisions in #26:
 * a local time skipped by the spring change is rejected, and a time that
 * occurs twice in the autumn takes the earlier instant.
 */

export const TALLINN = "Europe/Tallinn";

/** A calendar date in Tallinn: "YYYY-MM-DD". */
export type LocalDate = string;
/** A wall-clock time in Tallinn: "HH:MM", and "24:00" only as the end of a range. */
export type LocalTime = string;
/** A UTC instant in the only form the database accepts: "YYYY-MM-DDTHH:MM:SSZ". */
export type UtcInstant = string;

export type Resolved =
  | { ok: true; instant: UtcInstant }
  | { ok: false; reason: "invalid" | "nonexistent" };

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Years the app plans events in; older dates had other Tallinn offsets. */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

/** The parts of a real calendar date from MIN_YEAR to MAX_YEAR, or null (for example 2026-02-30). */
export function parseLocalDate(
  date: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

/** Minutes after local midnight, or null. "24:00" is 1440 and needs allowEndOfDay. */
export function parseLocalTime(
  time: string,
  { allowEndOfDay = false } = {},
): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours === 24 && minutes === 0) return allowEndOfDay ? 1440 : null;
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** A timestamp as a UTC instant; milliseconds are dropped. */
export function toUtcInstant(ms: number): UtcInstant {
  return new Date(ms).toISOString().slice(0, 19) + "Z";
}

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: TALLINN,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Tallinn's UTC offset in minutes at an instant: 120 in winter, 180 in summer. */
function offsetAt(utcMs: number): number {
  const parts = Object.fromEntries(
    wallClock.formatToParts(utcMs).map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((wall - utcMs) / MINUTE);
}

/**
 * The UTC instant of a Tallinn wall-clock time. "24:00" is the next local
 * midnight. A time skipped by the spring change is "nonexistent"; a time that
 * occurs twice in the autumn takes the earlier instant.
 */
export function tallinnToUtc(date: LocalDate, time: LocalTime): Resolved {
  const parts = parseLocalDate(date);
  const minutes = parseLocalTime(time, { allowEndOfDay: true });
  if (!parts || minutes === null) return { ok: false, reason: "invalid" };

  const wall = Date.UTC(parts.year, parts.month - 1, parts.day) + minutes * MINUTE;
  // Tallinn changes its offset at most once a day, so the offsets one day
  // either side are the only candidates. Keep those that map back to `wall`.
  const candidates = [...new Set([offsetAt(wall - DAY), offsetAt(wall + DAY)])]
    .map((offset) => wall - offset * MINUTE)
    .filter((utc) => utc + offsetAt(utc) * MINUTE === wall)
    .sort((a, b) => a - b);

  return candidates.length === 0
    ? { ok: false, reason: "nonexistent" }
    : { ok: true, instant: toUtcInstant(candidates[0]) };
}

/** A local day as a UTC interval: 23 or 25 hours long on the daylight saving dates. */
export function tallinnDay(
  date: LocalDate,
): { start: UtcInstant; end: UtcInstant } | null {
  const start = tallinnToUtc(date, "00:00");
  const end = tallinnToUtc(date, "24:00");
  return start.ok && end.ok ? { start: start.instant, end: end.instant } : null;
}

const dayName = new Intl.DateTimeFormat("et-EE", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const clock = new Intl.DateTimeFormat("et-EE", {
  timeZone: TALLINN,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

/** A local date for display: "Teisipäev, 1. detsember 2026". */
export function formatLocalDate(date: LocalDate): string {
  const parts = parseLocalDate(date);
  if (!parts) throw new RangeError(`Not a calendar date: ${date}`);
  // Noon UTC is the same calendar date everywhere, so formatting in UTC is safe.
  const text = dayName.format(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return text.charAt(0).toLocaleUpperCase("et-EE") + text.slice(1);
}

/**
 * The Tallinn wall-clock time of a UTC instant: "14:00". In the repeated hour
 * of the autumn change both instants read the same, e.g. "03:30" (#26).
 */
export function formatTallinnTime(instant: UtcInstant): string {
  return clock.format(Date.parse(instant));
}
