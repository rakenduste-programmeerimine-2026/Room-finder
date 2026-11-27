import { charLength } from "./text";
import { MIN_DURATION } from "./time/time-windows";

/** The longest event the UI offers (#37: 12 h); the database allows up to 1440 minutes. */
export const MAX_UI_DURATION = 720;
export const MAX_NAME_LENGTH = 100;
export const MAX_EVENT_TYPE_LENGTH = 60;
export const MAX_ATTENDEES = 10_000;

/** The duration choices, in minutes: short steps for short events, then every hour up to 12 h. */
export const DURATION_CHOICES = [
  5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 660, 720,
] as const;
export const DEFAULT_DURATION = 90;

/** What the user typed or chose; text fields are kept as typed. */
export type EventDraft = { name: string; eventType: string; durationMinutes: number; attendees: string };

/** The event part of a search, as stored in `searches` (name, event_type, duration_minutes, attendees). */
export type EventDetails = { name: string | null; eventType: string; durationMinutes: number; attendees: number | null };

export type EventIssue =
  | "name_too_long"
  | "missing_event_type"
  | "event_type_too_long"
  | "invalid_duration"
  | "invalid_attendees";

export type ReadEvent = { ok: true; event: EventDetails } | { ok: false; issues: EventIssue[] };

export const EMPTY_EVENT: EventDraft = { name: "", eventType: "", durationMinutes: DEFAULT_DURATION, attendees: "" };

export const isEventDuration = (minutes: number): boolean =>
  Number.isInteger(minutes) && minutes >= MIN_DURATION && minutes <= MAX_UI_DURATION;

/** Reads the optional attendee count: null when empty, "invalid" unless a whole number from 1 to 10000. */
export function readAttendees(text: string): number | null | "invalid" {
  const raw = text.trim();
  if (raw === "") return null;
  const count = /^\d+$/.test(raw) ? Number(raw) : 0;
  return count >= 1 && count <= MAX_ATTENDEES ? count : "invalid";
}

/** Reads the event fields: trims the text, turns empty optional fields into null and checks the limits. */
export function readEvent(draft: EventDraft): ReadEvent {
  const issues: EventIssue[] = [];

  const name = draft.name.trim();
  if (charLength(name) > MAX_NAME_LENGTH) issues.push("name_too_long");

  const eventType = draft.eventType.trim();
  if (!eventType) issues.push("missing_event_type");
  else if (charLength(eventType) > MAX_EVENT_TYPE_LENGTH) issues.push("event_type_too_long");

  if (!isEventDuration(draft.durationMinutes)) issues.push("invalid_duration");

  const attendees = readAttendees(draft.attendees);
  if (attendees === "invalid") issues.push("invalid_attendees");

  if (issues.length || attendees === "invalid") return { ok: false, issues };
  return { ok: true, event: { name: name || null, eventType, durationMinutes: draft.durationMinutes, attendees } };
}
