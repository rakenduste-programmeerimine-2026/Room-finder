import { MIN_DURATION } from "./time/time-windows";

/** The longest event the UI offers (#37: 12 h); the database allows up to 1440 minutes. */
export const MAX_UI_DURATION = 720;
export const MAX_NAME_LENGTH = 100;
export const MAX_ATTENDEES = 10_000;

/** The duration choices, in minutes: short steps for short events, then every hour up to 12 h. */
export const DURATION_CHOICES = [
  5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 660, 720,
] as const;
export const DEFAULT_DURATION = 90;

/** What the user typed or chose; text fields are kept as typed. */
export type EventDraft = { name: string; durationMinutes: number; attendees: string };

/** The event part of a search, as stored in `searches` (name, duration_minutes, attendees). */
export type EventDetails = { name: string | null; durationMinutes: number; attendees: number | null };

export type EventIssue = "name_too_long" | "invalid_duration" | "invalid_attendees";

export type ReadEvent = { ok: true; event: EventDetails } | { ok: false; issues: EventIssue[] };

export const EMPTY_EVENT: EventDraft = { name: "", durationMinutes: DEFAULT_DURATION, attendees: "" };

export const isEventDuration = (minutes: number): boolean =>
  Number.isInteger(minutes) && minutes >= MIN_DURATION && minutes <= MAX_UI_DURATION;

/** Reads the event fields: trims the text, turns empty optional fields into null and checks the limits. */
export function readEvent(draft: EventDraft): ReadEvent {
  const issues: EventIssue[] = [];

  const name = draft.name.trim();
  // Counted in code points, like Postgres char_length().
  if ([...name].length > MAX_NAME_LENGTH) issues.push("name_too_long");

  if (!isEventDuration(draft.durationMinutes)) issues.push("invalid_duration");

  const rawAttendees = draft.attendees.trim();
  const attendees = /^\d+$/.test(rawAttendees) ? Number(rawAttendees) : null;
  if (rawAttendees !== "" && (attendees === null || attendees < 1 || attendees > MAX_ATTENDEES)) {
    issues.push("invalid_attendees");
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, event: { name: name || null, durationMinutes: draft.durationMinutes, attendees } };
}
