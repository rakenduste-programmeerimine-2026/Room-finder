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
} from "./setup-db";

type Room = {
  code: string;
  capacity: number;
  aliases: (string | null)[];
  complexity: string;
  event_types: string[];
};

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.rooms");
});

function insertRoom(overrides: Partial<Room> = {}) {
  const r: Room = {
    code: "T-101",
    capacity: 10,
    aliases: [],
    complexity: "other",
    event_types: [],
    ...overrides,
  };
  return db.query(
    `insert into public.rooms (code, capacity, aliases, complexity, event_types)
     values ($1, $2, $3, $4, $5)`,
    [r.code, r.capacity, r.aliases, r.complexity, r.event_types],
  );
}

const many = (n: number) => Array.from({ length: n }, (_, i) => `x${i}`);

describe("rooms constraints", () => {
  it.each<[string, Partial<Room>]>([
    ["capacity 1", { capacity: 1 }],
    ["1-character code", { code: "A" }],
    ["32-character code", { code: "C".repeat(32) }],
    ["100-character alias", { aliases: ["a".repeat(100)] }],
    ["20 aliases", { aliases: many(20) }],
    ["60-character event type", { event_types: ["e".repeat(60)] }],
    ["20 event types", { event_types: many(20) }],
    ...[
      "google_form",
      "institute_permission",
      "university_permission",
      "contact_owner",
      "other",
    ].map((c): [string, Partial<Room>] => [`complexity ${c}`, { complexity: c }]),
  ])("accepts %s", async (_, overrides) => {
    await expect(insertRoom(overrides)).resolves.toBeDefined();
  });

  it.each<[string, Partial<Room>, string]>([
    ["capacity 0", { capacity: 0 }, "rooms_capacity_positive"],
    ["capacity -1", { capacity: -1 }, "rooms_capacity_positive"],
    ["empty code", { code: "" }, "rooms_code_format"],
    ["33-character code", { code: "C".repeat(33) }, "rooms_code_format"],
    ["code with a leading space", { code: " A-1" }, "rooms_code_format"],
    ["101-character alias", { aliases: ["a".repeat(101)] }, "rooms_aliases_valid"],
    ["21 aliases", { aliases: many(21) }, "rooms_aliases_valid"],
    ["empty alias", { aliases: [""] }, "rooms_aliases_valid"],
    ["blank alias", { aliases: ["  "] }, "rooms_aliases_valid"],
    ["null alias", { aliases: [null] }, "rooms_aliases_valid"],
    ["61-character event type", { event_types: ["e".repeat(61)] }, "rooms_event_types_valid"],
    ["21 event types", { event_types: many(21) }, "rooms_event_types_valid"],
    ["unknown complexity", { complexity: "easy" }, "invalid input value for enum"],
  ])("rejects %s", async (_, overrides, error) => {
    await expect(insertRoom(overrides)).rejects.toThrow(error);
  });
});

describe("rooms aliases are many to one", () => {
  beforeEach(async () => {
    await insertRoom({ code: "A-543", aliases: ["Astra 543", "Saal"] });
  });

  it.each(["Saal", "saal", "SAAL"])("rejects alias %s on another room", async (alias) => {
    await expect(insertRoom({ code: "M-213", aliases: [alias] })).rejects.toThrow(
      'alias "Saal" already belongs to another room',
    );
  });

  it("lets a room keep its own aliases when updated, also with a new code", async () => {
    await db.exec(`update public.rooms set aliases = aliases || '{A543}' where code = 'A-543'`);
    await db.exec(`update public.rooms set code = 'A-544', aliases = '{Saal}' where code = 'A-543'`);
    const { rows } = await db.query<{ aliases: string[] }>("select aliases from public.rooms");
    expect(rows).toEqual([{ aliases: ["Saal"] }]);
  });
});

it("updates updated_at on change", async () => {
  await insertRoom();
  await db.exec(`update public.rooms set updated_at = '2026-01-01T00:00:00Z'`);
  await db.exec(`update public.rooms set capacity = 20`);
  const { rows } = await db.query<{ changed: boolean }>(
    `select updated_at > '2026-01-01T00:00:00Z' as changed from public.rooms`,
  );
  expect(rows[0].changed).toBe(true);
});

describe("rooms row level security", () => {
  beforeEach(async () => {
    await insertRoom();
  });

  it("lets a signed-in user read", async () => {
    await actAs(db, USER_A);
    const { rows } = await db.query("select code from public.rooms");
    expect(rows).toEqual([{ code: "T-101" }]);
  });

  it.each([
    `insert into public.rooms (code, capacity) values ('X-1', 5)`,
    `update public.rooms set capacity = 99`,
    `delete from public.rooms`,
  ])("does not let a signed-in user write: %s", async (sql) => {
    await actAs(db, USER_A);
    await expect(db.exec(sql)).rejects.toThrow("permission denied");
  });

  it("does not let anon read", async () => {
    await actAsAnon(db);
    await expect(db.query("select code from public.rooms")).rejects.toThrow("permission denied");
  });

  it("lets the service role write", async () => {
    await actAsService(db);
    await db.exec(`insert into public.rooms (code, capacity) values ('X-1', 5)`);
    await db.exec(`update public.rooms set capacity = 6 where code = 'X-1'`);
    const { rows } = await db.query("select capacity from public.rooms where code = 'X-1'");
    expect(rows).toEqual([{ capacity: 6 }]);
  });
});
