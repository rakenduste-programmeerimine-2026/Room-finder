import { describe, expect, it } from "vitest";
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

const empty: SummaryInput = { event: EMPTY_EVENT, roomGroup: null, roomCount: 0, windows: null, weightsChanged: false };
const values = (input: Partial<SummaryInput>) => summarise({ ...empty, ...input }).map((row) => row.value);

describe("summarise", () => {
  it("says what is still missing", () => {
    expect(summarise(empty)).toEqual([
      { label: "Üritus", value: "tüüp valimata · 1 h 30 min" },
      { label: "Ruumid", value: "valimata" },
      { label: "Kandidaatajad", value: "puuduvad või vigased" },
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
        weightsChanged: true,
      }),
    ).toEqual(["Koosolek · 1 h 30 min · 12 inimest", "4 ruumi · Nõukogu ruumid", "2 päeva · 3 vahemikku", "muudetud"]);
  });

  it("uses the singular for one", () => {
    expect(
      values({
        event: { ...EMPTY_EVENT, eventType: "Seminar", attendees: "1" },
        roomGroup: "Aulad",
        roomCount: 1,
        windows: windows([{ date: "2026-12-01", ranges: 1 }]),
      }),
    ).toEqual(["Seminar · 1 h 30 min · 1 inimene", "1 ruum · Aulad", "1 päev · 1 vahemik", "vaikimisi"]);
  });

  it("leaves out an invalid attendee count", () => {
    expect(values({ event: { ...EMPTY_EVENT, eventType: "Seminar", attendees: "0" } })[0]).toBe("Seminar · 1 h 30 min");
  });
});

describe("requiredChecks", () => {
  const ready = { ...EMPTY_EVENT, eventType: "Koosolek" };
  const someWindows = windows([{ date: "2026-12-01", ranges: 1 }]);

  it("lists every missing part, as in frame 08 C", () => {
    expect(requiredChecks(readEvent(EMPTY_EVENT), 0, null)).toEqual([
      { ok: false, text: "Vali vähemalt üks ruum (1.1)", target: "ruumid" },
      { ok: false, text: "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)", target: "kandidaatajad" },
      { ok: false, text: "Ürituse tüüp on valimata", target: "uritus" },
    ]);
  });

  it("is all ready with one room, one range and an event type", () => {
    const checks = requiredChecks(readEvent(ready), 1, someWindows);

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
    expect(requiredChecks(readEvent({ ...ready, ...change }), 1, someWindows)[2]).toEqual({
      ok: false,
      text: "Paranda ürituse andmeid",
      target: "uritus",
    });
  });
});
