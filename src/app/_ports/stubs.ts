import type { Backend, Room, RoomGroup, RoomGroupSave } from "./ports";

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

  return {
    semester: {
      // PLACEHOLDER(#20): an illustrative start of spring 2027 (1 February,
      // 00:00 in Tallinn), not taken from ASIO or the academic calendar. A
      // fixed date goes stale once it passes.
      nextStart: async () => "2027-01-31T22:00:00Z",
    },
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
  };
}
