import type { CandidateTimes, CsvState } from "./csv";
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
  /** The candidate times to send; null while they have problems. */
  windows: TimeWindows | null;
  csv: CsvState;
  /** The name of the chosen curriculum group, null if none. */
  curriculumGroup: string | null;
  curriculumCount: number;
  weightsChanged: boolean;
};

/** The inputs of a search in a few words. */
export function summarise(input: SummaryInput): SummaryRow[] {
  const { event, roomGroup, roomCount, windows, csv, curriculumGroup, curriculumCount, weightsChanged } = input;
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
    {
      label: "CSV-fail",
      value: csv.state === "none"
        ? "puudub"
        : `${csv.name} · ${
          csv.state === "checking"
            ? "kontrollimisel"
            : csv.state === "accepted"
              ? count(csv.rows, "rida", "rida")
              : "vigane, ei kasutata"
        }`,
    },
    {
      label: "Õppekavad",
      value: curriculumCount === 0
        ? "ei arvestata"
        : [count(curriculumCount, "õppekava", "õppekava"), curriculumGroup].filter(Boolean).join(" · "),
    },
    { label: "Kaalud", value: weightsChanged ? "muudetud" : "vaikimisi" },
  ];
}

/** A required part of the search; `target` is the id of the section heading that holds it. */
export type Check = { ok: boolean; text: string; target: "uritus" | "ruumid" | "kandidaatajad" };

const TIMES_TEXT: Record<Extract<CandidateTimes, { ok: false }>["issue"], string> = {
  missing: "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)",
  checking: "CSV-faili kontrollitakse (1.2)",
  manual_invalid: "Paranda käsitsi sisestatud ajad või kasuta ainult CSV-faili (1.2)",
  too_large: "Aegu on liiga palju: vähenda päevi või CSV-faili ridu (1.2)",
};

/**
 * What "Leia aeg ja ruum" needs (US-010): rooms (1.1), candidate times without problems, typed
 * or from a checked CSV file (1.2, 1.4), and event details within their limits. In the order of frame 08 C.
 */
export function requiredChecks(event: ReadEvent, roomCount: number, times: CandidateTimes): Check[] {
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
      ok: times.ok,
      text: times.ok ? "Vähemalt üks ajavahemik (1.2)" : TIMES_TEXT[times.issue],
      target: "kandidaatajad",
    },
    { ok: event.ok, text: eventText, target: "uritus" },
  ];
}
