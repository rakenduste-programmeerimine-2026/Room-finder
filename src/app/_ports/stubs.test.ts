import { describe, expect, it } from "vitest";
import { eventTypesContract } from "./contracts/event-types.contract";
import { roomGroupsContract } from "./contracts/room-groups.contract";
import { roomsContract } from "./contracts/rooms.contract";
import { semesterContract } from "./contracts/semester.contract";
import { createStubBackend } from "./stubs";

semesterContract(() => createStubBackend().semester);
roomsContract(() => createStubBackend().rooms);
roomGroupsContract(() => createStubBackend().roomGroups);
eventTypesContract(() => createStubBackend().eventTypes);

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
});
