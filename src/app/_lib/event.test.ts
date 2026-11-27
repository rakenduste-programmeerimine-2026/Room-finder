import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION,
  DURATION_CHOICES,
  EMPTY_EVENT,
  isEventDuration,
  readEvent,
  type EventDraft,
} from "./event";

const VALID: EventDraft = { ...EMPTY_EVENT, eventType: "koosolek" };
const read = (change: Partial<EventDraft>) => readEvent({ ...VALID, ...change });

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
  it("asks for an event type on the empty form", () => {
    expect(readEvent(EMPTY_EVENT)).toEqual({ ok: false, issues: ["missing_event_type"] });
  });

  it("reads a form with only the type as an unnamed 1 h 30 min event without an attendee count", () => {
    expect(readEvent(VALID)).toEqual({
      ok: true,
      event: { name: null, eventType: "koosolek", durationMinutes: 90, attendees: null },
    });
  });

  describe("event type", () => {
    it.each<[string, string]>([
      ["a", "a"],
      ["  Koosolek ", "Koosolek"],
      ["x".repeat(60), "x".repeat(60)],
      ["😀".repeat(60), "😀".repeat(60)],
    ])("reads %j as %j", (eventType, expected) => {
      const result = read({ eventType });
      expect(result.ok && result.event.eventType).toBe(expected);
    });

    it.each(["", "   "])("asks for a type when it is %j", (eventType) => {
      expect(read({ eventType })).toEqual({ ok: false, issues: ["missing_event_type"] });
    });

    it.each(["x".repeat(61), "😀".repeat(61)])("rejects 61 characters", (eventType) => {
      expect(read({ eventType })).toEqual({ ok: false, issues: ["event_type_too_long"] });
    });
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
    expect(read({ name: "a".repeat(101), eventType: "x".repeat(61), durationMinutes: 4, attendees: "0" })).toEqual({
      ok: false,
      issues: ["name_too_long", "event_type_too_long", "invalid_duration", "invalid_attendees"],
    });
  });
});
