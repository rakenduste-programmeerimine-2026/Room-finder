// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  actAs,
  actAsAdmin,
  actAsAnon,
  actAsService,
  createTestDb,
  USER_A,
  USER_B,
} from "./setup-db";

type Search = Record<string, unknown>;

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.searches; delete from public.saved_groups");
});

const TIME_WINDOWS = [
  {
    source: "tool",
    start: "2026-11-30T22:00:00Z",
    end: "2026-12-04T22:00:00Z",
    days: [
      {
        start: "2026-11-30T22:00:00Z",
        end: "2026-12-01T22:00:00Z",
        ranges: [{ start: "2026-12-01T08:00:00Z", end: "2026-12-01T12:00:00Z" }],
      },
    ],
  },
];

const JSON_COLUMNS = new Set(["room_items", "complexity_weights", "time_windows", "curricula", "result"]);

/** Insert a valid search, changed by overrides; JSON columns are passed as jsonb. */
function insertSearch(overrides: Search = {}) {
  const row: Search = {
    owner_id: USER_A,
    event_type: "koosolek",
    duration_minutes: 90,
    room_items: [{ room_code: "A-543" }],
    time_windows: TIME_WINDOWS,
    ...overrides,
  };
  const columns = Object.keys(row);
  const values = columns.map((c) =>
    JSON_COLUMNS.has(c) && row[c] !== null ? JSON.stringify(row[c]) : row[c],
  );
  const placeholders = columns.map((c, i) => `$${i + 1}${JSON_COLUMNS.has(c) ? "::jsonb" : ""}`);
  return db.query<{ id: string }>(
    `insert into public.searches (${columns.join(", ")}) values (${placeholders.join(", ")}) returning id`,
    values,
  );
}

const curriculum = {
  university: "TLÜ",
  building: "Peahoone",
  institute: "DTI",
  degree_level: "Bakalaureuseõpe",
  programme: "Informaatika",
};

describe("searches constraints", () => {
  it.each<[string, Search]>([
    ["empty weights", { complexity_weights: {} }],
    ["weights 0 and 1", { complexity_weights: { google_form: 1, other: 0 } }],
    ["weight 0.55", { complexity_weights: { contact_owner: 0.55 } }],
    ["duration 5", { duration_minutes: 5 }],
    ["duration 1440", { duration_minutes: 1440 }],
    ["attendees 1", { attendees: 1 }],
    ["attendees 10000", { attendees: 10000 }],
    ["1-character event type", { event_type: "K" }],
    ["60-character event type", { event_type: "e".repeat(60) }],
    ["100-character name", { name: "n".repeat(100) }],
    ["curricula", { curricula: [curriculum] }],
    ["255-character CSV file name", { csv_filename: `${"f".repeat(251)}.csv` }],
    ["done with a result", { status: "done", result: { best: null, unsuitable_groups: [] } }],
    ["failed with an error", { status: "failed", error: "ASIO is down" }],
  ])("accepts %s", async (_, overrides) => {
    await expect(insertSearch(overrides)).resolves.toBeDefined();
  });

  it.each<[string, Search, string]>([
    ["weight 1.01", { complexity_weights: { other: 1.01 } }, "searches_complexity_weights_valid"],
    ["weight -0.01", { complexity_weights: { other: -0.01 } }, "searches_complexity_weights_valid"],
    ["weight 0.555", { complexity_weights: { other: 0.555 } }, "searches_complexity_weights_valid"],
    ["a string weight", { complexity_weights: { other: "0.5" } }, "searches_complexity_weights_valid"],
    ["an unknown weight key", { complexity_weights: { easy: 1 } }, "searches_complexity_weights_valid"],
    ["weights as an array", { complexity_weights: [1] }, "searches_complexity_weights_valid"],
    ["duration 4", { duration_minutes: 4 }, "searches_duration_range"],
    ["duration 1441", { duration_minutes: 1441 }, "searches_duration_range"],
    ["attendees 0", { attendees: 0 }, "searches_attendees_range"],
    ["attendees 10001", { attendees: 10001 }, "searches_attendees_range"],
    ["empty event type", { event_type: "" }, "searches_event_type_format"],
    ["61-character event type", { event_type: "e".repeat(61) }, "searches_event_type_format"],
    ["event type with a space", { event_type: " koosolek" }, "searches_event_type_format"],
    ["empty name", { name: "" }, "searches_name_format"],
    ["101-character name", { name: "n".repeat(101) }, "searches_name_format"],
    ["no rooms", { room_items: [] }, "searches_room_items_valid"],
    ["empty curricula", { curricula: [] }, "searches_curricula_valid"],
    ["no time windows", { time_windows: [] }, "searches_time_windows_valid"],
    ["time windows as an object", { time_windows: {} }, "searches_time_windows_valid"],
    ["empty CSV file name", { csv_filename: "" }, "searches_csv_filename_length"],
    ["256-character CSV file name", { csv_filename: "f".repeat(256) }, "searches_csv_filename_length"],
    ["done without a result", { status: "done" }, "searches_result_matches_status"],
    ["pending with a result", { result: { best: null } }, "searches_result_matches_status"],
    ["a result that is an array", { status: "done", result: [] }, "searches_result_matches_status"],
    ["failed without an error", { status: "failed" }, "searches_error_matches_status"],
    ["pending with an error", { error: "x" }, "searches_error_matches_status"],
  ])("rejects %s", async (_, overrides, error) => {
    await expect(insertSearch(overrides)).rejects.toThrow(error);
  });

  it("accepts a weight for every complexity class in the enum", async () => {
    const { rows } = await db.query<{ c: string }>(
      "select unnest(enum_range(null::public.room_acquisition_complexity))::text as c",
    );
    const weights = Object.fromEntries(rows.map((r) => [r.c, 0.5]));
    await expect(insertSearch({ complexity_weights: weights })).resolves.toBeDefined();
  });
});

describe("searches row level security", () => {
  let searchOfA: string;

  beforeEach(async () => {
    searchOfA = (await insertSearch()).rows[0].id;
  });

  async function stateOfA() {
    await actAsAdmin(db);
    const { rows } = await db.query("select name, status from public.searches where id = $1", [searchOfA]);
    return rows[0];
  }

  it("hides the searches of another user", async () => {
    await actAs(db, USER_B);
    expect((await db.query("select id from public.searches")).rows).toEqual([]);
  });

  it.each([`update public.searches set name = 'Hacked'`, `delete from public.searches`])(
    "does not let another user change them: %s",
    async (sql) => {
      await actAs(db, USER_B);
      await db.exec(sql);
      expect(await stateOfA()).toEqual({ name: null, status: "pending" });
    },
  );

  it("lets the owner rename a search", async () => {
    await actAs(db, USER_A);
    await db.exec(`update public.searches set name = 'Koosolek'`);
    expect(await stateOfA()).toEqual({ name: "Koosolek", status: "pending" });
  });

  it.each([`status = 'done'`, `result = '{}'`, `error = 'x'`, `owner_id = '${USER_B}'`])(
    "does not let the owner set %s",
    async (assignment) => {
      await actAs(db, USER_A);
      await expect(db.exec(`update public.searches set ${assignment}`)).rejects.toThrow("permission denied");
    },
  );

  it.each<[string, Search]>([
    ["a finished search with a result", { status: "done", result: { best: null } }],
    ["a running search", { status: "running" }],
    ["a search for another user", { owner_id: USER_B }],
  ])("does not let a client insert %s", async (_, overrides) => {
    await actAs(db, USER_A);
    await expect(insertSearch(overrides)).rejects.toThrow("row-level security");
  });

  it("lets the service role write the status and the result", async () => {
    await actAsService(db);
    await db.exec(`update public.searches set status = 'running'`);
    await db.exec(`update public.searches set status = 'done', result = '{"best": null}'`);
    expect(await stateOfA()).toEqual({ name: null, status: "done" });
  });

  it("does not let anon read", async () => {
    await actAsAnon(db);
    await expect(db.query("select id from public.searches")).rejects.toThrow("permission denied");
  });

  it("links only to the owner's own group and forgets it when the group is deleted", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.saved_groups (owner_id, kind, name, items)
       values ($1, 'room', 'Ruumid', '[{"room_code": "A-543"}]') returning id`,
      [USER_A],
    );
    const group = rows[0].id;
    await expect(insertSearch({ owner_id: USER_B, source_room_group_id: group })).rejects.toThrow(
      "searches_source_room_group_fk",
    );
    const linked = (await insertSearch({ source_room_group_id: group })).rows[0].id;
    await db.query("delete from public.saved_groups where id = $1", [group]);
    const after = await db.query("select owner_id, source_room_group_id from public.searches where id = $1", [linked]);
    expect(after.rows).toEqual([{ owner_id: USER_A, source_room_group_id: null }]);
  });

  it("deletes the searches with their user", async () => {
    await db.exec(`delete from auth.users where id = '${USER_A}'`);
    expect((await db.query("select id from public.searches")).rows).toEqual([]);
    await db.exec(`insert into auth.users (id) values ('${USER_A}')`);
  });
});
