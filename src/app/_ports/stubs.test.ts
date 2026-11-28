import { describe, expect, it } from "vitest";
import { curriculumOf, withCourses } from "@/app/_lib/curricula";
import { buildTimeWindows } from "@/app/_lib/time/time-windows";
import { curriculaContract } from "./contracts/curricula.contract";
import { curriculumGroupsContract } from "./contracts/curriculum-groups.contract";
import { eventTypesContract } from "./contracts/event-types.contract";
import { roomGroupsContract } from "./contracts/room-groups.contract";
import { roomsContract } from "./contracts/rooms.contract";
import { searchesContract } from "./contracts/searches.contract";
import { semesterContract } from "./contracts/semester.contract";
import { createStubBackend } from "./stubs";

semesterContract(() => createStubBackend().semester);
roomsContract(() => createStubBackend().rooms);
roomGroupsContract(() => createStubBackend().roomGroups);
eventTypesContract(() => createStubBackend().eventTypes);
searchesContract(() => createStubBackend().searches, { pause: 0 });
curriculaContract(() => createStubBackend().curricula);
curriculumGroupsContract(() => createStubBackend().curriculumGroups);

describe("stub backend", () => {
  it("hands out copies, so the caller cannot change the store", async () => {
    const { rooms, roomGroups } = createStubBackend();
    (await rooms.list())[0].aliases.push("muudetud");
    expect((await rooms.list())[0].aliases).not.toContain("muudetud");

    const saved = await roomGroups.create("Aulad", ["DEMO-301"]);
    if (saved.ok) saved.group.roomCodes.push("DEMO-101");
    expect((await roomGroups.list())[0].roomCodes).toEqual(["DEMO-301"]);
  });

  it("knows the seeded event types", async () => {
    expect((await createStubBackend().eventTypes.popular()).map((t) => t.eventType)).toEqual([
      "kaitsmine",
      "koosolek",
      "loeng",
      "seminar",
      "töötuba",
    ]);
  });

  it("answers a search with made-up data: running first, then the first big enough room at the first range", async () => {
    const { searches } = createStubBackend();
    const built = buildTimeWindows([{ date: "2027-02-01", ranges: [{ start: "10:00", end: "12:00" }] }], 60);
    if (!built.ok) throw new Error();
    const id = await searches.start({
      name: null,
      eventType: "koosolek",
      durationMinutes: 60,
      attendees: 20,
      roomCodes: ["DEMO-103", "DEMO-401", "DEMO-101"],
      roomGroupId: null,
      complexityWeights: { other: 0.5 },
      timeWindows: built.windows,
      curricula: null,
      curriculumGroupId: null,
      csvFilename: null,
    });

    expect(await searches.status(id)).toEqual({ status: "running" });
    expect(await searches.status(id)).toEqual({
      status: "done",
      result: {
        best: { roomCode: "DEMO-401", start: "2027-02-01T08:00:00Z", end: "2027-02-01T09:00:00Z", score: 0.5 },
        unsuitableGroups: [],
        warnings: ["next_semester"],
      },
    });
  });

  it("makes up a class of the last chosen curriculum that starts 15 minutes after the best time", async () => {
    const { curricula, searches } = createStubBackend();
    const [first, second] = await curricula.list();
    const built = buildTimeWindows([{ date: "2026-12-01", ranges: [{ start: "10:00", end: "12:00" }] }], 60);
    if (!built.ok) throw new Error();
    const chosen = [curriculumOf(first), withCourses(curriculumOf(second), [second.courses[0]])];
    const id = await searches.start({
      name: null,
      eventType: "koosolek",
      durationMinutes: 60,
      attendees: null,
      roomCodes: ["DEMO-101"],
      roomGroupId: null,
      complexityWeights: {},
      timeWindows: built.windows,
      curricula: chosen,
      curriculumGroupId: null,
      csvFilename: null,
    });
    await searches.status(id);

    expect(await searches.status(id)).toMatchObject({
      result: {
        unsuitableGroups: [
          {
            curriculum: chosen[1],
            course: second.courses[0],
            conflicts: [{ start: "2026-12-01T08:15:00Z", end: "2026-12-01T09:15:00Z" }],
          },
        ],
      },
    });
  });

  it("keeps room and curriculum groups apart", async () => {
    const { roomGroups, curricula, curriculumGroups } = createStubBackend();
    await roomGroups.create("Aulad", ["DEMO-301"]);

    expect(await curriculumGroups.list()).toEqual([]);
    expect((await curriculumGroups.create("Aulad", [curriculumOf((await curricula.list())[0])])).ok).toBe(true);
  });
});
