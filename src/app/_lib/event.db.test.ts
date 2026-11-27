// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, USER_A } from "../../../tests/db/setup-db";
import { EMPTY_EVENT, readEvent, type EventDetails, type EventDraft } from "./event";

// The event fields the UI accepts must pass the checks on public.searches.
let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

const TIME_WINDOWS = [{
  source: "tool",
  start: "2026-11-30T22:00:00Z",
  end: "2026-12-01T22:00:00Z",
  days: [{
    start: "2026-11-30T22:00:00Z",
    end: "2026-12-01T22:00:00Z",
    ranges: [{ start: "2026-12-01T08:00:00Z", end: "2026-12-01T12:00:00Z" }],
  }],
}];

/** Inserts a search with the event fields; throws the database's error if a check fails. */
async function insert(event: EventDetails): Promise<void> {
  await db.query(
    `insert into public.searches (owner_id, name, event_type, duration_minutes, attendees, room_items, time_windows)
     values ($1, $2, $3, $4, $5, '[{"room_code": "A-543"}]'::jsonb, $6::jsonb)`,
    [USER_A, event.name, event.eventType, event.durationMinutes, event.attendees, JSON.stringify(TIME_WINDOWS)],
  );
}

function accepted(change: Partial<EventDraft>): EventDetails {
  const result = readEvent({ ...EMPTY_EVENT, eventType: "koosolek", ...change });
  if (!result.ok) throw new Error(result.issues.join());
  return result.event;
}

describe("event fields read by the UI", () => {
  it.each<[string, Partial<EventDraft>]>([
    ["only the event type", {}],
    ["a trimmed event type", { eventType: " Mälumäng " }],
    ["a 60-character event type", { eventType: "x".repeat(60) }],
    ["a trimmed name", { name: "  DigiTechi ÕN koosolek\t" }],
    ["a 100-character name", { name: "a".repeat(100) }],
    ["a 100-character emoji name", { name: "😀".repeat(100) }],
    ["the shortest duration", { durationMinutes: 5 }],
    ["the longest duration", { durationMinutes: 720 }],
    ["1 attendee", { attendees: "1" }],
    ["10 000 attendees", { attendees: "10000" }],
  ])("%s pass the searches checks", async (_label, change) => {
    await expect(insert(accepted(change))).resolves.toBeUndefined();
  });
});
