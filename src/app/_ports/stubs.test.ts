import { describe, expect, it } from "vitest";
import { buildTimeWindows } from "@/app/_lib/time/time-windows";
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
});
