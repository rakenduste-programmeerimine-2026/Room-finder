import { describe, expect, it } from "vitest";
import { checkGroup } from "./saved-group";

describe("checkGroup", () => {
  it("trims the name", () => {
    expect(checkGroup("  Nõukogu ruumid ", 1, [])).toEqual({ name: "Nõukogu ruumid", issues: [] });
  });

  it.each(["a", "a".repeat(100), "😀".repeat(100)])("accepts a name of %#: 1 or 100 characters", (name) => {
    expect(checkGroup(name, 1, []).issues).toEqual([]);
  });

  it.each(["", "   ", "\t"])("asks for a name when it is %j", (name) => {
    expect(checkGroup(name, 1, []).issues).toEqual(["missing_name"]);
  });

  it.each(["a".repeat(101), "😀".repeat(101)])("rejects 101 characters", (name) => {
    expect(checkGroup(name, 1, []).issues).toEqual(["name_too_long"]);
  });

  it("rejects a name another group of the kind has, after trimming, but not one that differs in case", () => {
    expect(checkGroup(" Aulad ", 1, ["Aulad"]).issues).toEqual(["name_taken"]);
    expect(checkGroup("aulad", 1, ["Aulad"]).issues).toEqual([]);
  });

  it.each([1, 2, 199, 200])("accepts %i items", (n) => {
    expect(checkGroup("Aulad", n, []).issues).toEqual([]);
  });

  it("asks for at least one item and allows at most 200", () => {
    expect(checkGroup("Aulad", 0, []).issues).toEqual(["empty"]);
    expect(checkGroup("Aulad", 201, []).issues).toEqual(["too_many"]);
  });

  it("lists a name and an item problem together", () => {
    expect(checkGroup("", 0, []).issues).toEqual(["missing_name", "empty"]);
  });
});
