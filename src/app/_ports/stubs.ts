import { DEFAULT_WEIGHTS } from "@/app/_lib/complexity";
import { toUtcInstant } from "@/app/_lib/time/tallinn";
import { buildTimeWindows } from "@/app/_lib/time/time-windows";
import type { AsioGroup, Backend, CsvCheck, Course, Curriculum, GroupSave, Room, SearchInput, SearchResult } from "./ports";

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

/** The groups of one curriculum, one per study year, as the ASIO page lists them; course codes run per year (101, 201). */
function curriculum(
  place: Pick<AsioGroup, "building" | "institute" | "degreeLevel">,
  programmeCode: string,
  programme: string,
  years: { suffix: string; name: string; courses: string[] }[],
  specialisation?: string,
): AsioGroup[] {
  return years.map((year, y) => ({
    asioId: `${programmeCode}${year.suffix}`,
    name: year.name,
    programmeCode,
    university: "TLÜ",
    ...place,
    programme,
    ...(specialisation ? { specialisation } : {}),
    courses: year.courses.map((name, i): Course => ({ code: `${programmeCode}.${(y + 1) * 100 + i + 1}`, name })),
  }));
}

const BACHELOR_A = { building: "Demo maja A", institute: "Demo digiinstituut", degreeLevel: "Bakalaureuseõpe" };
const BACHELOR_B = { building: "Demo maja B", institute: "Demo meediainstituut", degreeLevel: "Bakalaureuseõpe" };
const MASTER_A = { ...BACHELOR_A, degreeLevel: "Magistriõpe" };
const DOCTORAL_B = { ...BACHELOR_B, degreeLevel: "Doktoriõpe" };

// PLACEHOLDER(#30): made-up curricula in the structure of the ASIO page, not ASIO data.
const DEMO_CURRICULA: AsioGroup[] = [
  ...curriculum(BACHELOR_A, "DEMOINF", "Demo informaatika", [
    { suffix: "-1", name: "Demo informaatika 1. õ.-a.", courses: ["Demo programmeerimise alused", "Demo matemaatika"] },
    { suffix: "-2", name: "Demo informaatika 2. õ.-a.", courses: ["Demo andmebaasid", "Demo veebirakendused", "Demo statistika"] },
    { suffix: "-3", name: "Demo informaatika 3. õ.-a.", courses: ["Demo lõputöö seminar"] },
  ]),
  ...curriculum(BACHELOR_A, "DEMOINF_ta", "Demo informaatika", [
    { suffix: "-1", name: "Demo informaatika (Tarkvaraarendus) 1. õ.-a.", courses: ["Demo tarkvaratehnika"] },
    { suffix: "-2", name: "Demo informaatika (Tarkvaraarendus) 2. õ.-a.", courses: ["Demo testimine", "Demo pilveteenused"] },
  ], "Tarkvaraarendus"),
  ...curriculum(BACHELOR_A, "DEMOITB", "Demo infoteadus", [
    { suffix: "-1", name: "Demo infoteadus 1. õ.-a.", courses: ["Demo infootsing", "Demo arhiivindus"] },
    { suffix: "-1ok", name: "Demo infoteadus (osakoormus) 1. õ.-a.", courses: ["Demo infootsing"] },
  ]),
  ...curriculum(BACHELOR_B, "DEMOAVM", "Demo audiovisuaalne meedia", [
    { suffix: "-1", name: "Demo audiovisuaalne meedia 1. õ.-a.", courses: ["Demo filmiajalugu", "Demo kaameratöö"] },
    { suffix: "-2", name: "Demo audiovisuaalne meedia 2. õ.-a.", courses: ["Demo montaaž"] },
  ]),
  ...curriculum(MASTER_A, "DEMOINFM", "Demo infotehnoloogia juhtimine", [
    { suffix: "-1", name: "Demo infotehnoloogia juhtimine 1. õ.-a.", courses: ["Demo projektijuhtimine", "Demo IT-strateegia"] },
    { suffix: "-2", name: "Demo infotehnoloogia juhtimine 2. õ.-a.", courses: ["Demo magistriseminar"] },
  ]),
  ...curriculum(DOCTORAL_B, "DEMOMED", "Demo meediauuringud", [
    { suffix: "", name: "Demo meediauuringud", courses: ["Demo doktoriseminar"] },
  ]),
];

// PLACEHOLDER(#20): an illustrative start of spring 2027 (1 February, 00:00 in
// Tallinn), not taken from ASIO or the academic calendar. A fixed date goes
// stale once it passes.
const NEXT_SEMESTER = "2027-01-31T22:00:00Z";

/**
 * PLACEHOLDER(#31): a made-up answer that does not read the file. A file whose name has "viga" in it
 * gets two row errors; any other file gives two days in December 2026 as CSV periods.
 */
function madeUpCsvCheck(name: string): CsvCheck {
  if (name.toLocaleLowerCase("et").includes("viga")) {
    return {
      ok: false,
      errors: [
        { row: 4, message: "lõpp on enne algust" },
        { row: 9, message: "kuupäeva 2026-02-30 ei ole kalendris" },
      ],
    };
  }
  const built = buildTimeWindows(
    [
      { date: "2026-12-08", ranges: [{ start: "10:00", end: "12:00" }, { start: "13:00", end: "15:00" }] },
      { date: "2026-12-09", ranges: [{ start: "09:00", end: "11:30" }] },
    ],
    5,
  );
  if (!built.ok) throw new Error("the made-up CSV times are invalid");
  return { ok: true, rows: 3, timeWindows: built.windows.map((period) => ({ ...period, source: "csv" })) };
}

const later = (instant: string, minutes: number) => toUtcInstant(Date.parse(instant) + minutes * 60_000);

/**
 * PLACEHOLDER(#23): a made-up answer, not the matching of #22. It takes the
 * first ranked room big enough for the attendees and the start of the first
 * candidate range, and says the last chosen curriculum has a class 15 minutes
 * later, so that the loading screen and the result can be tried.
 */
function madeUpResult(input: SearchInput): SearchResult {
  const room = input.roomCodes
    .map((code) => DEMO_ROOMS.find((r) => r.code === code))
    .find((r) => r && (input.attendees === null || r.capacity >= input.attendees));
  const range = input.timeWindows[0]?.days[0]?.ranges[0];
  if (!room || !range) return { best: null, unsuitableGroups: [], warnings: [] };
  const end = later(range.start, input.durationMinutes);
  const score = input.complexityWeights[room.complexity] ?? DEFAULT_WEIGHTS[room.complexity];
  const clashing = input.curricula?.at(-1);
  return {
    best: { roomCode: room.code, start: range.start, end, score },
    unsuitableGroups: clashing
      ? [{
          curriculum: clashing,
          ...(clashing.courses?.length ? { course: clashing.courses[0] } : {}),
          conflicts: [{ start: later(range.start, 15), end: later(end, 15) }],
        }]
      : [],
    warnings: range.start >= NEXT_SEMESTER ? ["next_semester"] : [],
  };
}

/** Named groups in memory, unique by name as `saved_groups` is per user and kind. */
function savedGroups<T, G extends { id: string; name: string }>(make: (id: string, name: string, items: T[]) => G) {
  const groups = new Map<string, G>();
  const save = (id: string, name: string, items: T[]): GroupSave<G> => {
    if ([...groups.values()].some((g) => g.id !== id && g.name === name)) return { ok: false, reason: "name_taken" };
    const group = make(id, name, structuredClone(items));
    groups.set(id, group);
    return { ok: true, group: structuredClone(group) };
  };
  return {
    list: async () => [...groups.values()].map((g) => structuredClone(g)),
    create: async (name: string, items: T[]) => save(crypto.randomUUID(), name, items),
    update: async (id: string, name: string, items: T[]) => {
      if (!groups.has(id)) throw new Error(`Unknown group ${id}`);
      return save(id, name, items);
    },
  };
}

/** Stand-ins for the backend until its adapters exist. Each call starts with an empty store. */
export function createStubBackend(): Backend {
  // PLACEHOLDER(#23): searches live in memory; the first status check says "running", the next one "done".
  const searches = new Map<string, { input: SearchInput; checks: number }>();

  return {
    semester: { nextStart: async () => NEXT_SEMESTER },
    rooms: { list: async () => structuredClone(DEMO_ROOMS) },
    // PLACEHOLDER(#19): room groups live in memory and are gone after a reload.
    roomGroups: savedGroups((id, name, roomCodes: string[]) => ({ id, name, roomCodes })),
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
    curricula: { list: async () => structuredClone(DEMO_CURRICULA) },
    // PLACEHOLDER(#30): curriculum groups live in memory and are gone after a reload.
    curriculumGroups: savedGroups((id, name, curricula: Curriculum[]) => ({ id, name, curricula })),
    csvFiles: { check: async (file) => madeUpCsvCheck(file.name) },
  };
}
