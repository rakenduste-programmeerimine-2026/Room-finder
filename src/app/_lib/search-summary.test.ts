import { describe, expect, it } from "vitest";
import { NO_CSV, type CsvState } from "./csv";
import { EMPTY_EVENT, readEvent } from "./event";
import { requiredChecks, summarise, type SummaryInput } from "./search-summary";
import { buildTimeWindows } from "./time/time-windows";

const windows = (days: { date: string; ranges: number }[]) => {
  const built = buildTimeWindows(
    days.map(({ date, ranges }) => ({
      date,
      ranges: Array.from({ length: ranges }, (_, i) => ({ start: `${10 + i}:00`, end: `${11 + i}:00` })),
    })),
    60,
  );
  if (!built.ok) throw new Error("invalid fixture");
  return built.windows;
};

const empty: SummaryInput = {
  event: EMPTY_EVENT,
  roomGroup: null,
  roomCount: 0,
  windows: null,
  csv: NO_CSV,
  curriculumGroup: null,
  curriculumCount: 0,
  weightsChanged: false,
};
const values = (input: Partial<SummaryInput>) => summarise({ ...empty, ...input }).map((row) => row.value);

describe("summarise", () => {
  it("says what is still missing", () => {
    expect(summarise(empty)).toEqual([
      { label: "Üritus", value: "tüüp valimata · 1 h 30 min" },
      { label: "Ruumid", value: "valimata" },
      { label: "Kandidaatajad", value: "puuduvad või vigased" },
      { label: "CSV-fail", value: "puudub" },
      { label: "Õppekavad", value: "ei arvestata" },
      { label: "Kaalud", value: "vaikimisi" },
    ]);
  });

  it("sums up a filled search as in frame 01", () => {
    expect(
      values({
        event: { name: "", eventType: " Koosolek ", durationMinutes: 90, attendees: "12" },
        roomGroup: "Nõukogu ruumid",
        roomCount: 4,
        windows: windows([{ date: "2026-12-01", ranges: 2 }, { date: "2026-12-02", ranges: 1 }]),
        curriculumGroup: "DTI bakalaureus",
        curriculumCount: 3,
        weightsChanged: true,
      }),
    ).toEqual([
      "Koosolek · 1 h 30 min · 12 inimest",
      "4 ruumi · Nõukogu ruumid",
      "2 päeva · 3 vahemikku",
      "puudub",
      "3 õppekava · DTI bakalaureus",
      "muudetud",
    ]);
  });

  it("uses the singular for one", () => {
    expect(
      values({
        event: { ...EMPTY_EVENT, eventType: "Seminar", attendees: "1" },
        roomGroup: "Aulad",
        roomCount: 1,
        windows: windows([{ date: "2026-12-01", ranges: 1 }]),
        curriculumGroup: "Informaatika",
        curriculumCount: 1,
      }),
    ).toEqual([
      "Seminar · 1 h 30 min · 1 inimene",
      "1 ruum · Aulad",
      "1 päev · 1 vahemik",
      "puudub",
      "1 õppekava · Informaatika",
      "vaikimisi",
    ]);
  });

  it.each<[CsvState, string]>([
    [{ state: "checking", name: "ajad.csv" }, "ajad.csv · kontrollimisel"],
    [{ state: "accepted", name: "ajad.csv", rows: 1, windows: [] }, "ajad.csv · 1 rida"],
    [{ state: "accepted", name: "ajad.csv", rows: 14, windows: [] }, "ajad.csv · 14 rida"],
    [{ state: "rejected", name: "vana.csv", errors: [{ row: 4, message: "x" }] }, "vana.csv · vigane, ei kasutata"],
  ])("names the CSV file and its state: %j", (csv, text) => {
    expect(values({ csv })[3]).toBe(text);
  });

  it("leaves out an invalid attendee count", () => {
    expect(values({ event: { ...EMPTY_EVENT, eventType: "Seminar", attendees: "0" } })[0]).toBe("Seminar · 1 h 30 min");
  });
});

describe("requiredChecks", () => {
  const ready = { ...EMPTY_EVENT, eventType: "Koosolek" };
  const someTimes = { ok: true, windows: windows([{ date: "2026-12-01", ranges: 1 }]), csvFilename: null } as const;

  it("lists every missing part, as in frame 08 C", () => {
    expect(requiredChecks(readEvent(EMPTY_EVENT), 0, { ok: false, issue: "missing" })).toEqual([
      { ok: false, text: "Vali vähemalt üks ruum (1.1)", target: "ruumid" },
      { ok: false, text: "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)", target: "kandidaatajad" },
      { ok: false, text: "Ürituse tüüp on valimata", target: "uritus" },
    ]);
  });

  it("is all ready with one room, one range and an event type", () => {
    const checks = requiredChecks(readEvent(ready), 1, someTimes);

    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.map((c) => c.text)).toEqual([
      "Ruumid valitud (1.1)",
      "Vähemalt üks ajavahemik (1.2)",
      "Ürituse tüüp ja kestus valitud",
    ]);
  });

  it.each([
    ["101 characters in the name", { name: "a".repeat(101) }],
    ["0 attendees", { attendees: "0" }],
    ["10001 attendees", { attendees: "10001" }],
    ["61 characters in the event type", { eventType: "a".repeat(61) }],
  ])("asks to fix the event with %s", (_, change) => {
    expect(requiredChecks(readEvent({ ...ready, ...change }), 1, someTimes)[2]).toEqual({
      ok: false,
      text: "Paranda ürituse andmeid",
      target: "uritus",
    });
  });

  it.each([
    ["checking", "CSV-faili kontrollitakse (1.2)"],
    ["manual_invalid", "Paranda käsitsi sisestatud ajad või kasuta ainult CSV-faili (1.2)"],
    ["too_large", "Aegu on liiga palju: vähenda päevi või CSV-faili ridu (1.2)"],
  ] as const)("says why the times are not ready: %s", (issue, text) => {
    expect(requiredChecks(readEvent(ready), 1, { ok: false, issue })[1]).toEqual({ ok: false, text, target: "kandidaatajad" });
  });
});
