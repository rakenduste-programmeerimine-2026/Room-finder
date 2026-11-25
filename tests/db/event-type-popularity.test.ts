// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, actAsAdmin, actAsAnon, createTestDb, USER_A, USER_B } from "./setup-db";

const USER_C = "00000000-0000-4000-8000-00000000000c";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.query("insert into auth.users (id) values ($1)", [USER_C]);
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.searches; delete from public.rooms");
});

const WINDOWS = JSON.stringify([
  {
    source: "tool",
    start: "2026-11-30T22:00:00Z",
    end: "2026-12-01T22:00:00Z",
    days: [
      {
        start: "2026-11-30T22:00:00Z",
        end: "2026-12-01T22:00:00Z",
        ranges: [{ start: "2026-12-01T08:00:00Z", end: "2026-12-01T12:00:00Z" }],
      },
    ],
  },
]);

async function addSearches(owner: string, eventTypes: string[]) {
  for (const eventType of eventTypes) {
    await db.query(
      `insert into public.searches (owner_id, event_type, duration_minutes, room_items, time_windows)
       values ($1, $2, 60, '[{"room_code": "A-543"}]', $3::jsonb)`,
      [owner, eventType, WINDOWS],
    );
  }
}

async function popularity() {
  return db.query<{ event_type: string; use_count: number }>(
    "select * from public.event_type_popularity()",
  );
}

describe("event_type_popularity()", () => {
  beforeEach(async () => {
    await db.exec(
      `insert into public.rooms (code, capacity, event_types)
       values ('A-543', 30, '{koosolek,Seminar}')`,
    );
    await addSearches(USER_A, ["Koosolek", "Koosolek", "loeng"]);
    await addSearches(USER_B, ["koosolek", "Kaitsmine"]);
  });

  const rows = async (user: string) => {
    await actAs(db, user);
    return (await popularity()).rows.map((r) => [r.event_type, Number(r.use_count)]);
  };

  it.each<[string, string, [string, number][]]>([
    ["user A sees seeded, shared and own types", USER_A, [["Koosolek", 3], ["loeng", 1], ["Seminar", 0]]],
    ["user B sees seeded, shared and own types", USER_B, [["Koosolek", 3], ["Kaitsmine", 1], ["Seminar", 0]]],
    ["user C without searches sees seeded and shared types", USER_C, [["Koosolek", 3], ["Seminar", 0]]],
  ])("%s, counting every user's searches case-insensitively", async (_, user, expected) => {
    expect(await rows(user)).toEqual(expected);
  });

  it("does not show a type used by only one other user", async () => {
    const types = async (user: string) => (await rows(user)).map(([type]) => type);
    expect(await types(USER_B)).not.toContain("loeng");
    expect(await types(USER_A)).not.toContain("Kaitsmine");
    expect(await types(USER_C)).not.toContain("loeng");
  });

  it("shows a type to everyone once a second owner uses it", async () => {
    await actAsAdmin(db);
    await addSearches(USER_B, ["loeng"]);
    for (const user of [USER_A, USER_B, USER_C]) {
      expect(await rows(user)).toContainEqual(["loeng", 2]);
    }
  });

  it("returns only the aggregate columns event_type and use_count", async () => {
    await actAs(db, USER_B);
    const { fields } = await popularity();
    expect(fields.map((f) => f.name)).toEqual(["event_type", "use_count"]);
  });

  it("does not let anon call it", async () => {
    await actAsAnon(db);
    await expect(popularity()).rejects.toThrow("permission denied");
  });
});

it("returns nothing for an empty database", async () => {
  await actAs(db, USER_A);
  expect((await popularity()).rows).toEqual([]);
});

it("is a stable security definer with an empty search_path and no parameters", async () => {
  const { rows } = await db.query(
    `select p.pronargs as args, p.prosecdef as definer, p.provolatile as volatility,
            p.proconfig as config
     from pg_proc p where p.oid = 'public.event_type_popularity()'::regprocedure`,
  );
  expect(rows).toEqual([{ args: 0, definer: true, volatility: "s", config: ['search_path=""'] }]);
});

it("is executable by authenticated only, not by PUBLIC or anon", async () => {
  const { rows } = await db.query(
    `select has_function_privilege('authenticated', 'public.event_type_popularity()', 'execute') as authenticated,
            has_function_privilege('anon', 'public.event_type_popularity()', 'execute') as anon,
            exists (
              select 1 from pg_proc p, aclexplode(p.proacl) a
              where p.oid = 'public.event_type_popularity()'::regprocedure
                and a.grantee = 0 and a.privilege_type = 'EXECUTE'
            ) as public`,
  );
  expect(rows).toEqual([{ authenticated: true, anon: false, public: false }]);
});
