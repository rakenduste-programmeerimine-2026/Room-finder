// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, USER_A } from "./setup-db";

type Node = Record<string, unknown>;
type Levels = { p?: Node; d?: Node; r?: Node; s?: Node | null };

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

// 1 December 2026 in Tallinn (UTC+2) is 2026-11-30T22:00Z .. 2026-12-01T22:00Z.
const P = { source: "tool", start: "2026-11-30T22:00:00Z", end: "2026-12-04T22:00:00Z" };
const D = { start: "2026-11-30T22:00:00Z", end: "2026-12-01T22:00:00Z" };
const R = { start: "2026-12-01T08:00:00Z", end: "2026-12-01T12:00:00Z" };
const S = { start: "2026-12-01T08:00:00Z", end: "2026-12-01T09:30:00Z" };

/** One period > day > range > slot, each level changed by its override; s: null drops slots. */
function tree({ p = {}, d = {}, r = {}, s = {} }: Levels = {}): unknown {
  const range = s === null ? { ...R, ...r } : { ...R, slots: [{ ...S, ...s }], ...r };
  return [{ ...P, days: [{ ...D, ranges: [range], ...d }], ...p }];
}

async function isValid(windows: unknown): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    "select public.is_valid_time_windows($1::jsonb) as ok",
    [JSON.stringify(windows)],
  );
  return rows[0].ok;
}

const day = (start: string, end: string): Levels => ({
  p: { start, end },
  d: { start, end },
  r: { start, end },
  s: null,
});

describe("is_valid_time_windows accepts", () => {
  it.each<[string, unknown]>([
    ["a full tree with a slot", tree()],
    ["a range without slots", tree({ s: null })],
    ["a range with empty slots", tree({ r: { slots: [] } })],
    ["children touching both parent edges", tree({ r: D, s: D })],
    ["a CSV period", tree({ p: { source: "csv" } })],
    ["a range across UTC midnight", tree({ r: { start: "2026-11-30T23:00:00Z", end: "2026-12-01T01:00:00Z" }, s: null })],
    ["a 23-hour local day (spring DST)", tree(day("2026-03-28T22:00:00Z", "2026-03-29T21:00:00Z"))],
    ["a 25-hour local day (autumn DST)", tree(day("2026-10-24T21:00:00Z", "2026-10-25T22:00:00Z"))],
    ["a period across a week edge", tree({ p: { start: "2026-12-05T22:00:00Z", end: "2026-12-07T22:00:00Z" }, ...day("2026-12-06T22:00:00Z", "2026-12-07T22:00:00Z") })],
    ["a day across the year edge", tree(day("2026-12-31T22:00:00Z", "2027-01-01T22:00:00Z"))],
    ["50 periods", Array(50).fill((tree() as unknown[])[0])],
    ["200 ranges in a day", tree({ d: { ranges: Array(200).fill(R) } })],
  ])("%s", async (_, windows) => {
    expect(await isValid(windows)).toBe(true);
  });
});

describe("is_valid_time_windows rejects", () => {
  it.each<[string, unknown]>([
    ["milliseconds", "2026-12-01T08:00:00.000Z"],
    ["a +02:00 offset", "2026-12-01T10:00:00+02:00"],
    ["a +00:00 offset", "2026-12-01T08:00:00+00:00"],
    ["a lowercase z", "2026-12-01T08:00:00z"],
    ["a space instead of T", "2026-12-01 08:00:00Z"],
    ["missing seconds", "2026-12-01T08:00Z"],
    ["a date without a time", "2026-12-01"],
    ["a number", 1764576000],
    ["null", null],
  ])("a start with %s", async (_, start) => {
    expect(await isValid(tree({ r: { start }, s: null }))).toBe(false);
  });

  it.each<[string, Levels]>([
    ["start = end", { r: { end: R.start }, s: null }],
    ["start > end", { r: { start: R.end, end: R.start }, s: null }],
    ["a range starting before its day", { r: { start: "2026-11-30T21:59:59Z" }, s: null }],
    ["a range ending after its day", { r: { end: "2026-12-01T22:00:01Z" }, s: null }],
    ["a day outside its period", { d: { start: "2026-12-04T22:00:00Z", end: "2026-12-05T22:00:00Z" } }],
    ["a slot outside its range", { s: { end: "2026-12-01T12:00:01Z" } }],
    ["a period without source", { p: { source: undefined } }],
    ["an unknown source", { p: { source: "manual" } }],
    ["a period without days", { p: { days: [] } }],
    ["days that are not an array", { p: { days: {} } }],
    ["a day without ranges", { d: { ranges: [] } }],
    ["slots that are not an array", { r: { slots: {} } }],
    ["an unknown key on a period", { p: { label: "x" } }],
    ["an unknown key on a day", { d: { label: "x" } }],
    ["an unknown key on a range", { r: { label: "x" }, s: null }],
    ["a fifth level", { s: { slots: [S] } }],
    ["201 ranges in a day", { d: { ranges: Array(201).fill(R) } }],
  ])("%s", async (_, levels) => {
    expect(await isValid(tree(levels))).toBe(false);
  });

  it.each<[string, unknown]>([
    ["an empty array", []],
    ["an object", { periods: [] }],
    ["a period that is not an object", ["2026-12-01"]],
    ["51 periods", Array(51).fill((tree() as unknown[])[0])],
  ])("a root that is %s", async (_, windows) => {
    expect(await isValid(windows)).toBe(false);
  });
});

it("is used by the searches.time_windows check", async () => {
  await expect(
    db.query(
      `insert into public.searches (owner_id, event_type, duration_minutes, room_items, time_windows)
       values ($1, 'koosolek', 60, '[{"room_code": "A-543"}]', $2::jsonb)`,
      [USER_A, JSON.stringify(tree({ r: { start: "2026-12-01T08:00:00.000Z" }, s: null }))],
    ),
  ).rejects.toThrow("searches_time_windows_valid");
});
