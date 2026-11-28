import { DEFAULT_WEIGHTS } from "@/app/_lib/complexity";
import { toUtcInstant } from "@/app/_lib/time/tallinn";
import type { Backend, Room, RoomGroup, RoomGroupSave, SearchInput, SearchResult } from "./ports";

const room = (
  code: string,
  capacity: number,
  bookableForTeaching: boolean,
  aliases: string[],
  complexity: Room["complexity"],
  eventTypes: string[],
): Room => ({ code, capacity, bookableForTeaching, aliases, complexity, eventTypes });

// PLACEHOLDER(#40): the DEMO rooms of supabase/seed.sql, not ASIO data.
const DEMO_ROOMS: Room[] = [
  room("DEMO-101", 30, true, ["Demo auditoorium 101"], "google_form", ["loeng", "seminar"]),
  room("DEMO-102", 24, true, ["Demo arvutiklass"], "google_form", ["seminar", "töötuba"]),
  room("DEMO-103", 8, false, ["Demo nõupidamisruum", "Demo väike ruum"], "google_form", ["koosolek"]),
  room("DEMO-201", 120, true, ["Demo suur saal"], "university_permission", ["loeng", "kaitsmine"]),
  room("DEMO-202", 40, true, ["Demo seminariruum 202"], "institute_permission", ["seminar", "kaitsmine"]),
  room("DEMO-203", 16, false, ["Demo projektiruum"], "institute_permission", ["koosolek", "töötuba"]),
  room("DEMO-301", 200, false, ["Demo aula", "Demo konverentsisaal"], "university_permission", ["loeng", "koosolek"]),
  room("DEMO-302", 12, false, ["Demo stuudio"], "contact_owner", ["töötuba"]),
  room("DEMO-303", 60, false, ["Demo raamatukogu saal"], "contact_owner", ["seminar", "koosolek"]),
  room("DEMO-401", 20, false, ["Demo kohvik"], "other", ["koosolek"]),
];

// PLACEHOLDER(#20): an illustrative start of spring 2027 (1 February, 00:00 in
// Tallinn), not taken from ASIO or the academic calendar. A fixed date goes
// stale once it passes.
const NEXT_SEMESTER = "2027-01-31T22:00:00Z";

/**
 * PLACEHOLDER(#23): a made-up answer, not the matching of #22. It takes the
 * first ranked room big enough for the attendees and the start of the first
 * candidate range, so that the loading screen and the result can be tried.
 */
function madeUpResult(input: SearchInput): SearchResult {
  const room = input.roomCodes
    .map((code) => DEMO_ROOMS.find((r) => r.code === code))
    .find((r) => r && (input.attendees === null || r.capacity >= input.attendees));
  const range = input.timeWindows[0]?.days[0]?.ranges[0];
  if (!room || !range) return { best: null, unsuitableGroups: [], warnings: [] };
  const end = toUtcInstant(Date.parse(range.start) + input.durationMinutes * 60_000);
  const score = input.complexityWeights[room.complexity] ?? DEFAULT_WEIGHTS[room.complexity];
  return {
    best: { roomCode: room.code, start: range.start, end, score },
    unsuitableGroups: [],
    warnings: range.start >= NEXT_SEMESTER ? ["next_semester"] : [],
  };
}

/** Stand-ins for the backend until its adapters exist. Each call starts with an empty store. */
export function createStubBackend(): Backend {
  // PLACEHOLDER(#19): room groups live in memory and are gone after a reload.
  const groups = new Map<string, RoomGroup>();
  const copy = (group: RoomGroup): RoomGroup => ({ ...group, roomCodes: [...group.roomCodes] });
  const save = (id: string, name: string, roomCodes: string[]): RoomGroupSave => {
    if ([...groups.values()].some((g) => g.id !== id && g.name === name)) return { ok: false, reason: "name_taken" };
    const group = { id, name, roomCodes: [...roomCodes] };
    groups.set(id, group);
    return { ok: true, group: copy(group) };
  };
  // PLACEHOLDER(#23): searches live in memory; the first status check says "running", the next one "done".
  const searches = new Map<string, { input: SearchInput; checks: number }>();

  return {
    semester: { nextStart: async () => NEXT_SEMESTER },
    rooms: {
      list: async () => DEMO_ROOMS.map((r) => ({ ...r, aliases: [...r.aliases], eventTypes: [...r.eventTypes] })),
    },
    roomGroups: {
      list: async () => [...groups.values()].map(copy),
      create: async (name, roomCodes) => save(crypto.randomUUID(), name, roomCodes),
      update: async (id, name, roomCodes) => {
        if (!groups.has(id)) throw new Error(`Unknown room group ${id}`);
        return save(id, name, roomCodes);
      },
    },
    eventTypes: {
      // PLACEHOLDER(#40): the seeded types before any search, as event_type_popularity() lists them.
      popular: async () =>
        [...new Set(DEMO_ROOMS.flatMap((r) => r.eventTypes))]
          .sort((a, b) => (a < b ? -1 : 1))
          .map((eventType) => ({ eventType, useCount: 0 })),
    },
    searches: {
      start: async (input) => {
        const id = crypto.randomUUID();
        searches.set(id, { input: structuredClone(input), checks: 0 });
        return id;
      },
      status: async (id) => {
        const search = searches.get(id);
        if (!search) throw new Error(`Unknown search ${id}`);
        search.checks += 1;
        return search.checks === 1 ? { status: "running" } : { status: "done", result: madeUpResult(search.input) };
      },
    },
  };
}
