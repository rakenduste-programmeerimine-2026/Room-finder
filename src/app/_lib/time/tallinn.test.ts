import { afterEach, describe, expect, it } from "vitest";
import {
  formatLocalDate,
  formatTallinnDate,
  formatTallinnDay,
  formatTallinnTime,
  formatUtcTime,
  parseLocalDate,
  parseLocalTime,
  tallinnDay,
  tallinnToUtc,
  toUtcInstant,
} from "./tallinn";

const DB_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const instant = (date: string, time: string) => {
  const result = tallinnToUtc(date, time);
  if (!result.ok) throw new Error(`${date} ${time}: ${result.reason}`);
  return result.instant;
};
const hours = (day: { start: string; end: string } | null) =>
  day ? (Date.parse(day.end) - Date.parse(day.start)) / 3_600_000 : null;

describe("parseLocalDate", () => {
  it.each([
    ["2026-12-01", true],
    ["2028-02-29", true], // leap year
    ["2026-02-29", false],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-1-01", false],
    ["0026-01-01", false],
    ["1999-12-31", false], // before MIN_YEAR
    ["2000-01-01", true],
    ["2099-12-31", true],
    ["2100-01-01", false], // after MAX_YEAR
    ["", false],
  ])("%s → real date: %s", (date, real) => {
    expect(parseLocalDate(date) !== null).toBe(real);
  });
});

describe("parseLocalTime", () => {
  it.each([
    ["00:00", false, 0],
    ["23:59", false, 1439],
    ["24:00", false, null],
    ["24:00", true, 1440],
    ["24:01", true, null],
    ["12:60", false, null],
    ["7:00", false, null],
    ["07:00:00", false, null],
  ])("%s (end of day allowed: %s) → %s", (time, allowEndOfDay, minutes) => {
    expect(parseLocalTime(time, { allowEndOfDay })).toBe(minutes);
  });
});

describe("toUtcInstant", () => {
  it("drops the milliseconds that toISOString adds", () => {
    expect(toUtcInstant(Date.parse("2026-12-01T08:00:00.000Z"))).toBe("2026-12-01T08:00:00Z");
    expect(toUtcInstant(Date.parse("2026-12-01T08:00:00.999Z"))).toBe("2026-12-01T08:00:00Z");
  });
});

describe("tallinnToUtc", () => {
  it.each([
    ["winter (UTC+2)", "2026-12-01", "10:00", "2026-12-01T08:00:00Z"],
    ["summer (UTC+3)", "2026-07-15", "10:00", "2026-07-15T07:00:00Z"],
    ["local midnight", "2026-12-01", "00:00", "2026-11-30T22:00:00Z"],
    ["24:00 is the next midnight", "2026-12-01", "24:00", "2026-12-01T22:00:00Z"],
    ["one minute before midnight", "2026-12-01", "23:59", "2026-12-01T21:59:00Z"],
    ["year edge", "2027-01-01", "00:00", "2026-12-31T22:00:00Z"],
    ["week edge (Sunday to Monday)", "2026-12-07", "00:00", "2026-12-06T22:00:00Z"],
    ["leap day", "2028-02-29", "12:00", "2028-02-29T10:00:00Z"],
  ])("%s: %s %s → %s", (_label, date, time, expected) => {
    expect(instant(date, time)).toBe(expected);
  });

  describe("spring change, 29 March 2026: 03:00–03:59 does not exist", () => {
    it.each([
      ["02:59", "2026-03-29T00:59:00Z"],
      ["04:00", "2026-03-29T01:00:00Z"],
    ])("%s → %s", (time, expected) => {
      expect(instant("2026-03-29", time)).toBe(expected);
    });

    it.each(["03:00", "03:30", "03:59"])("%s is rejected", (time) => {
      expect(tallinnToUtc("2026-03-29", time)).toEqual({ ok: false, reason: "nonexistent" });
    });
  });

  describe("autumn change, 25 October 2026: 03:00–03:59 occurs twice", () => {
    it.each([
      ["02:59", "2026-10-24T23:59:00Z"],
      ["03:00", "2026-10-25T00:00:00Z"], // earlier of 00:00Z and 01:00Z
      ["03:59", "2026-10-25T00:59:00Z"], // earlier of 00:59Z and 01:59Z
      ["04:00", "2026-10-25T02:00:00Z"],
    ])("%s → %s", (time, expected) => {
      expect(instant("2026-10-25", time)).toBe(expected);
    });
  });

  it.each([
    ["2026-02-30", "10:00"],
    ["2026-12-01", "25:00"],
    ["2026-12-01", "10:5"],
  ])("rejects %s %s as invalid", (date, time) => {
    expect(tallinnToUtc(date, time)).toEqual({ ok: false, reason: "invalid" });
  });

  it("always returns the database format", () => {
    for (const time of ["00:00", "09:30", "23:59", "24:00"]) {
      expect(instant("2026-06-30", time)).toMatch(DB_FORMAT);
    }
  });
});

describe("tallinnDay", () => {
  it("is 24 hours on an ordinary day", () => {
    expect(tallinnDay("2026-12-01")).toEqual({ start: "2026-11-30T22:00:00Z", end: "2026-12-01T22:00:00Z" });
  });

  it("is 23 hours on 29 March 2026", () => {
    const day = tallinnDay("2026-03-29");
    expect(day).toEqual({ start: "2026-03-28T22:00:00Z", end: "2026-03-29T21:00:00Z" });
    expect(hours(day)).toBe(23);
  });

  it("is 25 hours on 25 October 2026", () => {
    const day = tallinnDay("2026-10-25");
    expect(day).toEqual({ start: "2026-10-24T21:00:00Z", end: "2026-10-25T22:00:00Z" });
    expect(hours(day)).toBe(25);
  });

  it("is null for a date that does not exist", () => {
    expect(tallinnDay("2026-02-30")).toBeNull();
  });
});

describe("independent of the system time zone", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it.each([
    ["Asia/Tokyo", -540],
    ["America/Los_Angeles", 480],
    ["Europe/Tallinn", -120],
  ])("gives the same instants with TZ=%s", (zone, winterOffset) => {
    process.env.TZ = zone;
    // Proves the system zone really changed for this test.
    expect(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()).toBe(winterOffset);
    expect(instant("2026-10-25", "03:30")).toBe("2026-10-25T00:30:00Z");
    expect(tallinnToUtc("2026-03-29", "03:30")).toEqual({ ok: false, reason: "nonexistent" });
    expect(tallinnDay("2026-03-29")).toEqual({ start: "2026-03-28T22:00:00Z", end: "2026-03-29T21:00:00Z" });
  });
});

describe("formatting for display", () => {
  it("names the local date in Estonian with a capital letter", () => {
    expect(formatLocalDate("2026-12-01")).toBe("Teisipäev, 1. detsember 2026");
    expect(formatLocalDate("2027-02-02")).toBe("Teisipäev, 2. veebruar 2027");
  });

  it("shows UTC instants in Tallinn time", () => {
    expect(formatTallinnTime("2026-12-01T12:00:00Z")).toBe("14:00");
    expect(formatTallinnTime("2026-07-15T07:05:00Z")).toBe("10:05");
    expect(formatTallinnTime("2026-11-30T22:00:00Z")).toBe("00:00");
  });

  it("jumps from 02:59 to 04:00 at the spring change", () => {
    expect(formatTallinnTime("2026-03-29T00:59:00Z")).toBe("02:59");
    expect(formatTallinnTime("2026-03-29T01:00:00Z")).toBe("04:00");
  });

  it("shows both instants of the repeated autumn hour as the same time (accepted in #26)", () => {
    expect(formatTallinnTime("2026-10-25T00:30:00Z")).toBe("03:30");
    expect(formatTallinnTime("2026-10-25T01:30:00Z")).toBe("03:30");
    expect(formatTallinnTime("2026-10-25T02:00:00Z")).toBe("04:00");
  });

  it("names the Tallinn date of a UTC instant, also when it is still the previous day in UTC", () => {
    expect(formatTallinnDate("2027-01-31T22:00:00Z")).toBe("1. veebruar 2027");
    expect(formatTallinnDate("2026-07-15T21:30:00Z")).toBe("16. juuli 2026");
  });

  it("names the Tallinn day of a UTC instant with its weekday, across midnight and the changes", () => {
    expect(formatTallinnDay("2026-11-30T21:59:59Z")).toBe("Esmaspäev, 30. november 2026");
    expect(formatTallinnDay("2026-11-30T22:00:00Z")).toBe("Teisipäev, 1. detsember 2026");
    expect(formatTallinnDay("2026-12-31T22:00:00Z")).toBe("Reede, 1. jaanuar 2027");
    expect(formatTallinnDay("2026-03-28T22:00:00Z")).toBe("Pühapäev, 29. märts 2026"); // 00:00 at UTC+2
    expect(formatTallinnDay("2026-03-29T21:00:00Z")).toBe("Esmaspäev, 30. märts 2026"); // 00:00 at UTC+3
    expect(formatTallinnDay("2026-10-24T20:59:59Z")).toBe("Laupäev, 24. oktoober 2026");
    expect(formatTallinnDay("2026-10-24T21:00:00Z")).toBe("Pühapäev, 25. oktoober 2026");
  });

  it("shows the UTC time of an instant", () => {
    expect(formatUtcTime("2026-12-01T12:00:00Z")).toBe("12:00");
    expect(formatUtcTime("2026-11-30T23:59:00Z")).toBe("23:59");
  });

  it("refuses a date that does not exist", () => {
    expect(() => formatLocalDate("2026-02-30")).toThrow(RangeError);
  });
});
