import { describe, expect, it } from "vitest";
import {
  buildTimeWindows,
  datesInNextSemester,
  MAX_DAYS,
  MAX_RANGES_PER_DAY,
  type DraftDay,
} from "./time-windows";

const ninety = 90;
const day = (date: string, ...ranges: [string, string][]): DraftDay => ({
  date,
  ranges: ranges.map(([start, end]) => ({ start, end })),
});
const issuesOf = (days: DraftDay[], duration = ninety) => {
  const built = buildTimeWindows(days, duration);
  return built.ok ? [] : built.issues;
};
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
/** `count` five-minute ranges from 06:00 (200 of them end at 22:40). */
const fiveMinuteRanges = (date: string, count: number) =>
  day(date, ...Array.from({ length: count }, (_, i): [string, string] => [hhmm(360 + 5 * i), hhmm(365 + 5 * i)]));
const dateAfter = (start: string, days: number) =>
  new Date(Date.parse(`${start}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe("buildTimeWindows", () => {
  it("builds one tool period in UTC and keeps the user's order as the preference rank", () => {
    const built = buildTimeWindows(
      [day("2026-12-02", ["09:00", "11:30"]), day("2026-12-01", ["13:00", "16:00"], ["10:00", "12:00"])],
      ninety,
    );
    expect(built).toEqual({
      ok: true,
      windows: [
        {
          source: "tool",
          start: "2026-11-30T22:00:00Z", // earliest day, although it is ranked second
          end: "2026-12-02T22:00:00Z",
          days: [
            {
              start: "2026-12-01T22:00:00Z",
              end: "2026-12-02T22:00:00Z",
              ranges: [{ start: "2026-12-02T07:00:00Z", end: "2026-12-02T09:30:00Z" }],
            },
            {
              start: "2026-11-30T22:00:00Z",
              end: "2026-12-01T22:00:00Z",
              ranges: [
                { start: "2026-12-01T11:00:00Z", end: "2026-12-01T14:00:00Z" },
                { start: "2026-12-01T08:00:00Z", end: "2026-12-01T10:00:00Z" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("accepts a range that ends at local midnight (24:00)", () => {
    const built = buildTimeWindows([day("2026-12-01", ["23:00", "24:00"])], 60);
    expect(built.ok && built.windows[0].days[0].ranges[0]).toEqual({
      start: "2026-12-01T21:00:00Z",
      end: "2026-12-01T22:00:00Z",
    });
  });

  it("keeps overlapping and repeated ranges as entered (the solver takes the union)", () => {
    const built = buildTimeWindows([day("2026-12-01", ["10:00", "12:00"], ["10:00", "12:00"], ["11:00", "13:00"])], 60);
    expect(built.ok && built.windows[0].days[0].ranges).toHaveLength(3);
  });

  describe("required input", () => {
    it("needs at least one day", () => {
      expect(issuesOf([])).toEqual([{ code: "no_days" }]);
    });

    it("needs at least one range per day", () => {
      expect(issuesOf([day("2026-12-01")])).toEqual([{ code: "no_ranges", day: 0 }]);
    });

    it("rejects a date that does not exist and a repeated date", () => {
      expect(
        issuesOf([day("2026-02-30", ["10:00", "12:00"]), day("2026-12-01", ["10:00", "12:00"]), day("2026-12-01", ["14:00", "16:00"])]),
      ).toEqual([
        { code: "invalid_date", day: 0 },
        { code: "duplicate_date", day: 2 },
      ]);
    });

    it.each([
      [4, false],
      [5, true],
      [1440, true],
      [1441, false],
      [90.5, false],
      [Number.NaN, false],
    ])("event duration %s minutes is valid: %s", (duration, valid) => {
      const issues = issuesOf([day("2026-12-01", ["00:00", "24:00"])], duration);
      expect(issues).toEqual(valid ? [] : [{ code: "invalid_duration" }]);
    });
  });

  describe("ranges", () => {
    it.each([
      ["end before start", ["12:00", "10:00"], "end_not_after_start"],
      ["end equal to start", ["10:00", "10:00"], "end_not_after_start"],
      ["one minute shorter than the event", ["10:00", "11:29"], "shorter_than_duration"],
      ["24:00 as the start", ["24:00", "24:00"], "invalid_time"],
      ["malformed time", ["10:00", "1:30"], "invalid_time"],
    ])("rejects %s", (_label, range, code) => {
      expect(issuesOf([day("2026-12-01", range as [string, string])])).toEqual([{ code, day: 0, range: 0 }]);
    });

    it("accepts a range exactly as long as the event", () => {
      expect(issuesOf([day("2026-12-01", ["10:00", "11:30"])])).toEqual([]);
    });

    it("measures real time across the spring change: 02:00–05:00 on 29 March 2026 is 2 hours", () => {
      expect(issuesOf([day("2026-03-29", ["02:00", "05:00"])], 120)).toEqual([]);
      expect(issuesOf([day("2026-03-29", ["02:00", "05:00"])], 121)).toEqual([
        { code: "shorter_than_duration", day: 0, range: 0 },
      ]);
    });

    it("measures real time across the autumn change: 02:00–05:00 on 25 October 2026 is 4 hours", () => {
      expect(issuesOf([day("2026-10-25", ["02:00", "05:00"])], 240)).toEqual([]);
      expect(issuesOf([day("2026-10-25", ["02:00", "05:00"])], 241)).toEqual([
        { code: "shorter_than_duration", day: 0, range: 0 },
      ]);
    });

    it.each([
      ["start", ["03:30", "06:00"]],
      ["end", ["01:00", "03:30"]],
    ])("rejects a %s skipped by the spring change", (_label, range) => {
      expect(issuesOf([day("2026-03-29", range as [string, string])])).toEqual([
        { code: "nonexistent_time", day: 0, range: 0 },
      ]);
    });

    it("reports a malformed time before a skipped one", () => {
      expect(issuesOf([day("2026-03-29", ["03:30", "6:00"])])).toEqual([
        { code: "invalid_time", day: 0, range: 0 },
      ]);
    });

    it("cannot fit a 24-hour event into the 23-hour day of 29 March 2026", () => {
      expect(issuesOf([day("2026-03-29", ["00:00", "24:00"])], 1440)).toEqual([
        { code: "shorter_than_duration", day: 0, range: 0 },
      ]);
      expect(issuesOf([day("2026-10-25", ["00:00", "24:00"])], 1440)).toEqual([]);
    });
  });

  describe("limits", () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => day(dateAfter("2027-01-01", i), ["10:00", "12:00"]));

    it(`allows ${MAX_DAYS} days and rejects ${MAX_DAYS + 1}`, () => {
      expect(issuesOf(days(MAX_DAYS))).toEqual([]);
      expect(issuesOf(days(MAX_DAYS + 1))).toEqual([{ code: "too_many_days" }]);
    });

    it(`allows ${MAX_RANGES_PER_DAY} ranges in a day and rejects ${MAX_RANGES_PER_DAY + 1}`, () => {
      expect(issuesOf([fiveMinuteRanges("2026-12-01", MAX_RANGES_PER_DAY)], 5)).toEqual([]);
      expect(issuesOf([fiveMinuteRanges("2026-12-01", MAX_RANGES_PER_DAY + 1)], 5)).toEqual([
        { code: "too_many_ranges", day: 0 },
      ]);
    });

    it("rejects input too large for the table (20 days of 200 ranges)", () => {
      const big = Array.from({ length: 20 }, (_, i) => fiveMinuteRanges(dateAfter("2027-01-01", i), 200));
      expect(issuesOf(big, 5)).toEqual([{ code: "too_large" }]);
    });
  });
});

describe("datesInNextSemester", () => {
  const S = "2027-01-31T22:00:00Z"; // 1 February 2027, 00:00 in Tallinn

  it("does not warn for the day before the semester starts", () => {
    expect(datesInNextSemester([day("2027-01-31", ["10:00", "12:00"])], S)).toEqual([]);
  });

  it("warns for the first day of the semester and later, sorted and without repeats", () => {
    const days = [day("2027-03-01"), day("2027-02-01"), day("2026-12-01"), day("2027-03-01")];
    expect(datesInNextSemester(days, S)).toEqual(["2027-02-01", "2027-03-01"]);
  });

  it("refuses a semester start that is not a UTC instant", () => {
    expect(() => datesInNextSemester([], "2027-02-01")).toThrow(RangeError);
  });
});
