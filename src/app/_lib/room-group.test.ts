import { describe, expect, it } from "vitest";
import { checkRoomGroup } from "./room-group";

const rooms = (n: number) => Array.from({ length: n }, (_, i) => `DEMO-${i}`);

describe("checkRoomGroup", () => {
  it("trims the name", () => {
    expect(checkRoomGroup("  Nõukogu ruumid ", rooms(1), [])).toEqual({ name: "Nõukogu ruumid", issues: [] });
  });

  it.each(["a", "a".repeat(100), "😀".repeat(100)])("accepts a name of %#: 1 or 100 characters", (name) => {
    expect(checkRoomGroup(name, rooms(1), []).issues).toEqual([]);
  });

  it.each(["", "   ", "\t"])("asks for a name when it is %j", (name) => {
    expect(checkRoomGroup(name, rooms(1), []).issues).toEqual(["missing_name"]);
  });

  it.each(["a".repeat(101), "😀".repeat(101)])("rejects 101 characters", (name) => {
    expect(checkRoomGroup(name, rooms(1), []).issues).toEqual(["name_too_long"]);
  });

  it("rejects a name another room group has, after trimming, but not one that differs in case", () => {
    expect(checkRoomGroup(" Aulad ", rooms(1), ["Aulad"]).issues).toEqual(["name_taken"]);
    expect(checkRoomGroup("aulad", rooms(1), ["Aulad"]).issues).toEqual([]);
  });

  it.each([1, 2, 199, 200])("accepts %i rooms", (n) => {
    expect(checkRoomGroup("Aulad", rooms(n), []).issues).toEqual([]);
  });

  it("asks for at least one room and allows at most 200", () => {
    expect(checkRoomGroup("Aulad", [], []).issues).toEqual(["no_rooms"]);
    expect(checkRoomGroup("Aulad", rooms(201), []).issues).toEqual(["too_many_rooms"]);
  });

  it("lists a name and a room problem together", () => {
    expect(checkRoomGroup("", [], []).issues).toEqual(["missing_name", "no_rooms"]);
  });
});
