// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/db/setup-db";
import { buildTimeWindows, type DraftDay } from "./time-windows";

// The UI's output must pass the database's own check, public.is_valid_time_windows().
let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

async function acceptedByDatabase(days: DraftDay[], duration: number): Promise<boolean> {
  const built = buildTimeWindows(days, duration);
  if (!built.ok) throw new Error(JSON.stringify(built.issues));
  const { rows } = await db.query<{ ok: boolean }>(
    "select public.is_valid_time_windows($1::jsonb) as ok",
    [JSON.stringify(built.windows)],
  );
  return rows[0].ok;
}

describe("time windows built by the UI", () => {
  it.each<[string, DraftDay[], number]>([
    ["two ordinary days", [
      { date: "2026-12-01", ranges: [{ start: "10:00", end: "12:00" }, { start: "13:00", end: "16:00" }] },
      { date: "2026-12-02", ranges: [{ start: "09:00", end: "11:30" }] },
    ], 90],
    ["a range ending at local midnight", [{ date: "2026-12-01", ranges: [{ start: "23:00", end: "24:00" }] }], 60],
    ["the 23-hour day of 29 March 2026", [{ date: "2026-03-29", ranges: [{ start: "00:00", end: "24:00" }] }], 60],
    ["the 25-hour day of 25 October 2026", [{ date: "2026-10-25", ranges: [{ start: "02:00", end: "04:00" }] }], 60],
    ["a year edge", [
      { date: "2026-12-31", ranges: [{ start: "22:00", end: "24:00" }] },
      { date: "2027-01-01", ranges: [{ start: "00:00", end: "02:00" }] },
    ], 60],
  ])("%s pass is_valid_time_windows()", async (_label, days, duration) => {
    expect(await acceptedByDatabase(days, duration)).toBe(true);
  });

  it("the largest input the UI accepts still fits the table's 262 144-byte size check", async () => {
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const fullDay = (i: number): DraftDay => ({
      date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10),
      ranges: Array.from({ length: 200 }, (_, r) => ({ start: hhmm(360 + 5 * r), end: hhmm(365 + 5 * r) })),
    });
    // Add full days until the UI refuses; the last accepted tree must fit the table.
    let largest: unknown = null;
    for (let n = 1; n <= 30; n++) {
      const built = buildTimeWindows(Array.from({ length: n }, (_, i) => fullDay(i)), 5);
      if (!built.ok) {
        expect(built.issues).toEqual([{ code: "too_large" }]);
        break;
      }
      largest = built.windows;
    }
    expect(largest).not.toBeNull();
    const { rows } = await db.query<{ bytes: number; ok: boolean }>(
      "select octet_length($1::jsonb::text) as bytes, public.is_valid_time_windows($1::jsonb) as ok",
      [JSON.stringify(largest)],
    );
    expect(rows[0].ok).toBe(true);
    expect(rows[0].bytes).toBeLessThanOrEqual(262_144);
  });
});
