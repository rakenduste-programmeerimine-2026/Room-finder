// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsAdmin,
  actAsAnon,
  actAsService,
  createTestDb,
  USER_A,
  USER_B,
} from "./setup-db";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

async function whoAmI(): Promise<{ uid: string | null; role: string }> {
  const { rows } = await db.query<{ uid: string | null; role: string }>(
    "select auth.uid() as uid, current_user as role",
  );
  return rows[0];
}

describe("PGlite test harness", () => {
  it("runs the database in UTC", async () => {
    const { rows } = await db.query<{ tz: string }>(
      "select current_setting('TimeZone') as tz",
    );
    expect(["UTC", "Etc/UTC", "GMT"]).toContain(rows[0].tz);
  });

  it("creates the two test users", async () => {
    await actAsAdmin(db);
    const { rows } = await db.query<{ id: string }>(
      "select id from auth.users order by id",
    );
    expect(rows.map((r) => r.id)).toEqual([USER_A, USER_B]);
  });

  it("acts as a signed-in anonymous user with auth.uid()", async () => {
    await actAs(db, USER_A);
    expect(await whoAmI()).toEqual({ uid: USER_A, role: "authenticated" });
    await actAs(db, USER_B);
    expect(await whoAmI()).toEqual({ uid: USER_B, role: "authenticated" });
  });

  it("acts as anon without a session", async () => {
    await actAsAnon(db);
    expect(await whoAmI()).toEqual({ uid: null, role: "anon" });
  });

  it("acts as the service role", async () => {
    await actAsService(db);
    expect(await whoAmI()).toEqual({ uid: null, role: "service_role" });
  });
});
