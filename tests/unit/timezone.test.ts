import { describe, expect, it } from "vitest";

describe("test environment time zone", () => {
  it("runs in UTC", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("has no UTC offset in winter or summer (no local daylight saving time)", () => {
    expect(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()).toBe(0);
    expect(new Date("2026-07-15T12:00:00Z").getTimezoneOffset()).toBe(0);
  });

  it("formats local time the same as UTC", () => {
    const date = new Date("2026-07-15T09:30:00Z");

    expect(date.getHours()).toBe(9);
    expect(date.toISOString()).toBe("2026-07-15T09:30:00.000Z");
  });
});
