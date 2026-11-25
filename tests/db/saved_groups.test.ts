// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, actAsAdmin, actAsAnon, createTestDb, USER_A, USER_B } from "./setup-db";

type Group = { owner: string; kind: string; name: string; items: unknown };

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.saved_groups");
});

function insertGroup(overrides: Partial<Group> = {}) {
  const g: Group = {
    owner: USER_A,
    kind: "room",
    name: "Minu ruumid",
    items: [{ room_code: "A-543" }],
    ...overrides,
  };
  return db.query<{ id: string }>(
    `insert into public.saved_groups (owner_id, kind, name, items)
     values ($1, $2, $3, $4::jsonb) returning id`,
    [g.owner, g.kind, g.name, JSON.stringify(g.items)],
  );
}

const rooms = (n: number) => Array.from({ length: n }, (_, i) => ({ room_code: `R-${i}` }));
const curriculum = {
  university: "TLÜ",
  building: "Peahoone",
  institute: "DTI",
  degree_level: "Bakalaureuseõpe",
  programme: "Informaatika",
};
const withoutProgramme = Object.fromEntries(
  Object.entries(curriculum).filter(([key]) => key !== "programme"),
);

describe("saved_groups constraints", () => {
  it.each<[string, Partial<Group>]>([
    ["1-character name", { name: "A" }],
    ["100-character name", { name: "n".repeat(100) }],
    ["1 room", { items: rooms(1) }],
    ["200 rooms", { items: rooms(200) }],
    ["minimal curriculum", { kind: "curriculum", items: [curriculum] }],
    ["curriculum with empty courses", { kind: "curriculum", items: [{ ...curriculum, courses: [] }] }],
    [
      "full curriculum",
      {
        kind: "curriculum",
        items: [
          {
            ...curriculum,
            specialisation: "Tarkvaraarendus",
            asio_id: "261123",
            courses: [{ code: "IFI6001.DT", name: "Example course" }],
          },
        ],
      },
    ],
  ])("accepts %s", async (_, overrides) => {
    await expect(insertGroup(overrides)).resolves.toBeDefined();
  });

  it.each<[string, Partial<Group>, string]>([
    ["empty name", { name: "" }, "saved_groups_name_format"],
    ["101-character name", { name: "n".repeat(101) }, "saved_groups_name_format"],
    ["name with a trailing space", { name: "Ruumid " }, "saved_groups_name_format"],
    ["0 items", { items: [] }, "saved_groups_items_valid"],
    ["201 items", { items: rooms(201) }, "saved_groups_items_valid"],
    ["an object instead of an array", { items: { room_code: "A-543" } }, "saved_groups_items_valid"],
    ["a string item", { items: ["A-543"] }, "saved_groups_items_valid"],
    ["a room item without room_code", { items: [{}] }, "saved_groups_items_valid"],
    ["a room item with an extra key", { items: [{ room_code: "A", rank: 1 }] }, "saved_groups_items_valid"],
    ["a numeric room_code", { items: [{ room_code: 5 }] }, "saved_groups_items_valid"],
    ["a 33-character room_code", { items: [{ room_code: "C".repeat(33) }] }, "saved_groups_items_valid"],
    ["a curriculum item in a room group", { items: [curriculum] }, "saved_groups_items_valid"],
    ["a curriculum without programme", { kind: "curriculum", items: [withoutProgramme] }, "saved_groups_items_valid"],
    ["a curriculum with an unknown key", { kind: "curriculum", items: [{ ...curriculum, year: 1 }] }, "saved_groups_items_valid"],
    ["courses that are not an array", { kind: "curriculum", items: [{ ...curriculum, courses: {} }] }, "saved_groups_items_valid"],
    ["a course without name", { kind: "curriculum", items: [{ ...curriculum, courses: [{ code: "X" }] }] }, "saved_groups_items_valid"],
    ["an unknown kind", { kind: "people" }, "invalid input value for enum"],
  ])("rejects %s", async (_, overrides, error) => {
    await expect(insertGroup(overrides)).rejects.toThrow(error);
  });

  it.each<[string, Partial<Group>, boolean]>([
    ["the same kind and owner", {}, false],
    ["another kind", { kind: "curriculum", items: [curriculum] }, true],
    ["another owner", { owner: USER_B }, true],
  ])("a duplicate name with %s is allowed: %s", async (_, overrides, allowed) => {
    await insertGroup();
    const second = insertGroup(overrides);
    await (allowed ? expect(second).resolves.toBeDefined() : expect(second).rejects.toThrow("saved_groups_name_unique"));
  });
});

describe("saved_groups row level security", () => {
  let groupOfA: string;

  beforeEach(async () => {
    groupOfA = (await insertGroup()).rows[0].id;
  });

  async function itemsOfA(): Promise<unknown> {
    await actAsAdmin(db);
    const { rows } = await db.query<{ name: string; items: unknown }>(
      "select name, items from public.saved_groups where id = $1",
      [groupOfA],
    );
    return rows[0];
  }

  it("lets the owner save a changed copy under a new name", async () => {
    await actAs(db, USER_A);
    await db.query(
      `insert into public.saved_groups (kind, name, items) values ('room', 'Koopia', $1::jsonb)`,
      [JSON.stringify(rooms(2))],
    );
    const { rows } = await db.query("select name from public.saved_groups order by name");
    expect(rows).toEqual([{ name: "Koopia" }, { name: "Minu ruumid" }]);
    expect(await itemsOfA()).toEqual({ name: "Minu ruumid", items: [{ room_code: "A-543" }] });
  });

  it("hides the rows of another user", async () => {
    await actAs(db, USER_B);
    const { rows } = await db.query("select id from public.saved_groups");
    expect(rows).toEqual([]);
  });

  it.each([
    `update public.saved_groups set name = 'Hacked'`,
    `delete from public.saved_groups`,
  ])("does not let another user change them: %s", async (sql) => {
    await actAs(db, USER_B);
    await db.exec(sql);
    expect(await itemsOfA()).toEqual({ name: "Minu ruumid", items: [{ room_code: "A-543" }] });
  });

  it("does not let a user insert a row for someone else", async () => {
    await actAs(db, USER_B);
    await expect(insertGroup({ owner: USER_A, name: "Võõras" })).rejects.toThrow("row-level security");
  });

  it("sets the owner to the signed-in user by default", async () => {
    await actAs(db, USER_B);
    const { rows } = await db.query<{ owner_id: string }>(
      `insert into public.saved_groups (kind, name, items)
       values ('room', 'B ruumid', '[{"room_code": "M-213"}]') returning owner_id`,
    );
    expect(rows[0].owner_id).toBe(USER_B);
  });

  it.each([`owner_id = '${USER_B}'`, `kind = 'curriculum'`])(
    "does not let the owner change %s",
    async (assignment) => {
      await actAs(db, USER_A);
      await expect(db.exec(`update public.saved_groups set ${assignment}`)).rejects.toThrow(
        "permission denied",
      );
    },
  );

  it("does not let anon read", async () => {
    await actAsAnon(db);
    await expect(db.query("select id from public.saved_groups")).rejects.toThrow("permission denied");
  });

  it("deletes the groups with their user", async () => {
    await db.exec(`delete from auth.users where id = '${USER_A}'`);
    const { rows } = await db.query("select id from public.saved_groups");
    expect(rows).toEqual([]);
    await db.exec(`insert into auth.users (id) values ('${USER_A}')`);
  });
});
