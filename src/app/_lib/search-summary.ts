import { readAttendees, type EventDraft, type ReadEvent } from "./event";
import { count, formatDuration } from "./format";
import type { TimeWindows } from "./time/time-windows";

/** One line of a search's summary (frame 01 "Kokkuvõte", frame 07 "Otsingu sisendid"). */
export type SummaryRow = { label: string; value: string };

export type SummaryInput = {
  event: EventDraft;
  /** The name of the chosen room group, null if none. */
  roomGroup: string | null;
  roomCount: number;
  /** Null while the time input has problems. */
  windows: TimeWindows | null;
  weightsChanged: boolean;
};

/** The inputs of a search in a few words. */
export function summarise({ event, roomGroup, roomCount, windows, weightsChanged }: SummaryInput): SummaryRow[] {
  const attendees = readAttendees(event.attendees);
  const days = windows?.flatMap((period) => period.days) ?? [];
  const ranges = days.flatMap((day) => day.ranges).length;
  const eventParts = [
    event.eventType.trim() || "tüüp valimata",
    formatDuration(event.durationMinutes),
    typeof attendees === "number" ? count(attendees, "inimene", "inimest") : "",
  ];
  return [
    { label: "Üritus", value: eventParts.filter(Boolean).join(" · ") },
    {
      label: "Ruumid",
      value: roomCount === 0 ? "valimata" : [count(roomCount, "ruum", "ruumi"), roomGroup].filter(Boolean).join(" · "),
    },
    {
      label: "Kandidaatajad",
      value: windows
        ? `${count(days.length, "päev", "päeva")} · ${count(ranges, "vahemik", "vahemikku")}`
        : "puuduvad või vigased",
    },
    { label: "Kaalud", value: weightsChanged ? "muudetud" : "vaikimisi" },
  ];
}

/** A required part of the search; `target` is the id of the section heading that holds it. */
export type Check = { ok: boolean; text: string; target: "uritus" | "ruumid" | "kandidaatajad" };

/**
 * What "Leia aeg ja ruum" needs (US-010): rooms (1.1), time ranges without
 * problems (1.2) and event details within their limits. In the order of frame 08 C.
 */
export function requiredChecks(event: ReadEvent, roomCount: number, windows: TimeWindows | null): Check[] {
  const eventText = event.ok
    ? "Ürituse tüüp ja kestus valitud"
    : event.issues.includes("missing_event_type")
      ? "Ürituse tüüp on valimata"
      : "Paranda ürituse andmeid";
  return [
    {
      ok: roomCount > 0,
      text: roomCount > 0 ? "Ruumid valitud (1.1)" : "Vali vähemalt üks ruum (1.1)",
      target: "ruumid",
    },
    {
      ok: windows !== null,
      text: windows ? "Vähemalt üks ajavahemik (1.2)" : "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)",
      target: "kandidaatajad",
    },
    { ok: event.ok, text: eventText, target: "uritus" },
  ];
}
