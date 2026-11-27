import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION,
  DURATION_CHOICES,
  EMPTY_EVENT,
  isEventDuration,
  readEvent,
  type EventDraft,
} from "./event";

const read = (change: Partial<EventDraft>) => readEvent({ ...EMPTY_EVENT, ...change });

describe("isEventDuration", () => {
  it.each([5, 6, 90, 719, 720])("accepts %i minutes", (minutes) => {
    expect(isEventDuration(minutes)).toBe(true);
  });

  it.each([-5, 0, 4, 721, 1440, 90.5, Number.NaN])("rejects %s minutes", (minutes) => {
    expect(isEventDuration(minutes)).toBe(false);
  });
});

describe("DURATION_CHOICES", () => {
  it("runs from 5 minutes to 12 hours in increasing order, every choice valid", () => {
    expect(DURATION_CHOICES[0]).toBe(5);
    expect(DURATION_CHOICES.at(-1)).toBe(720);
    expect([...DURATION_CHOICES].sort((a, b) => a - b)).toEqual([...DURATION_CHOICES]);
    expect(new Set(DURATION_CHOICES).size).toBe(DURATION_CHOICES.length);
    expect(DURATION_CHOICES.every(isEventDuration)).toBe(true);
  });

  it("includes the default", () => {
    expect(DURATION_CHOICES).toContain(DEFAULT_DURATION);
  });
});

describe("readEvent", () => {
  it("reads the empty form as an unnamed 1 h 30 min event without an attendee count", () => {
    expect(readEvent(EMPTY_EVENT)).toEqual({ ok: true, event: { name: null, durationMinutes: 90, attendees: null } });
  });

  describe("name", () => {
    it.each<[string, string | null]>([
      ["", null],
      ["   ", null],
      ["\t\n", null],
      ["A", "A"],
      ["  DigiTechi ÕN koosolek  ", "DigiTechi ÕN koosolek"],
      ["a".repeat(100), "a".repeat(100)],
      [` ${"a".repeat(100)} `, "a".repeat(100)],
      ["😀".repeat(100), "😀".repeat(100)], // 100 characters, 200 UTF-16 units
    ])("reads %j as %j", (name, expected) => {
      const result = read({ name });
      expect(result.ok && result.event.name).toBe(expected);
    });

    it.each(["a".repeat(101), "😀".repeat(101)])("rejects 101 characters", (name) => {
      expect(read({ name })).toEqual({ ok: false, issues: ["name_too_long"] });
    });
  });

  describe("attendees", () => {
    it.each<[string, number | null]>([
      ["", null],
      ["  ", null],
      ["1", 1],
      ["2", 2],
      [" 12 ", 12],
      ["012", 12],
      ["9999", 9999],
      ["10000", 10000],
    ])("reads %j as %j", (attendees, expected) => {
      const result = read({ attendees });
      expect(result.ok && result.event.attendees).toBe(expected);
    });

    it.each(["0", "00", "10001", "99999999999999999999", "-1", "+1", "1.5", "1,5", "1e3", "12 inimest", "١٢"])(
      "rejects %j",
      (attendees) => {
        expect(read({ attendees })).toEqual({ ok: false, issues: ["invalid_attendees"] });
      },
    );
  });

  it("keeps the chosen duration", () => {
    const result = read({ durationMinutes: 720 });
    expect(result.ok && result.event.durationMinutes).toBe(720);
  });

  it("lists every problem at once", () => {
    expect(read({ name: "a".repeat(101), durationMinutes: 4, attendees: "0" })).toEqual({
      ok: false,
      issues: ["name_too_long", "invalid_duration", "invalid_attendees"],
    });
  });
});
