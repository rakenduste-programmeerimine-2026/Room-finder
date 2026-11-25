import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const STUB_SQL = join(HERE, "supabase-stub.sql");

export const USER_A = "00000000-0000-4000-8000-00000000000a";
export const USER_B = "00000000-0000-4000-8000-00000000000b";

/** Fresh in-memory Postgres with the Supabase stub and all migrations applied. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();

  await db.exec(readFileSync(STUB_SQL, "utf8"));

  const migrations = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort()
    : [];
  for (const file of migrations) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  await db.query(
    "insert into auth.users (id) values ($1), ($2)",
    [USER_A, USER_B],
  );

  return db;
}

/** Run as a signed-in (anonymous) Supabase user, like a request with a JWT. */
export async function actAs(db: PGlite, userId: string): Promise<void> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated", is_anonymous: true }),
  ]);
  await db.exec("set role authenticated");
}

/** Run as a visitor without any session (Supabase "anon" role). */
export async function actAsAnon(db: PGlite): Promise<void> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.exec("set role anon");
}

/** Run as the server with the secret key (Supabase "service_role", bypasses RLS). */
export async function actAsService(db: PGlite): Promise<void> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.exec("set role service_role");
}

/** Back to the superuser (bypasses RLS) for test setup and assertions. */
export async function actAsAdmin(db: PGlite): Promise<void> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
}
