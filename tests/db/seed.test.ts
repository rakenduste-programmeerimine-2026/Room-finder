// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { actAs, actAsAdmin, createTestDb, USER_A } from "./setup-db";

const SEED = readFileSync(join(__dirname, "..", "..", "supabase", "seed.sql"), "utf8");

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(SEED);
});

afterAll(async () => {
  await db?.close();
});

it("loads 10 sample rooms, all with a DEMO- code", async () => {
  const { rows } = await db.query<{ n: number; demo: boolean }>(
    "select count(*)::int as n, bool_and(code like 'DEMO-%') as demo from public.rooms",
  );
  expect(rows).toEqual([{ n: 10, demo: true }]);
});

it("can run again without failing or duplicating rooms", async () => {
  await db.exec(SEED);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.rooms");
  expect(rows[0].n).toBe(10);
});

it("covers every acquisition complexity class", async () => {
  const { rows } = await db.query<{ missing: string[] }>(
    `select array(
       select unnest(enum_range(null::public.room_acquisition_complexity))::text
       except select complexity::text from public.rooms
     ) as missing`,
  );
  expect(rows[0].missing).toEqual([]);
});

it("has rooms both bookable and not bookable for teaching", async () => {
  const { rows } = await db.query<{ b: boolean }>(
    "select distinct bookable_for_teaching as b from public.rooms order by b",
  );
  expect(rows.map((r) => r.b)).toEqual([false, true]);
});

it("offers the seeded event types with count 0 before any search", async () => {
  await actAs(db, USER_A);
  const { rows } = await db.query<{ event_type: string; use_count: number }>(
    "select * from public.event_type_popularity()",
  );
  await actAsAdmin(db);
  expect(rows.map((r) => [r.event_type, Number(r.use_count)])).toEqual([
    ["kaitsmine", 0],
    ["koosolek", 0],
    ["loeng", 0],
    ["seminar", 0],
    ["töötuba", 0],
  ]);
});
