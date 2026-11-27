import { describe, expect, it } from "vitest";
import { move } from "./move";

describe("move", () => {
  const list = ["a", "b", "c"];

  it.each([
    [1, 0, ["b", "a", "c"]], // up
    [0, 1, ["b", "a", "c"]], // down
    [0, 2, ["b", "c", "a"]], // first to last
    [2, 0, ["c", "a", "b"]], // last to first
    [1, 1, ["a", "b", "c"]], // same place
    [0, -1, ["a", "b", "c"]], // above the first
    [2, 3, ["a", "b", "c"]], // below the last
  ])("moves %i to %i", (from, to, expected) => {
    expect(move(list, from, to)).toEqual(expected);
  });

  it("does not change the original list", () => {
    move(list, 0, 2);
    expect(list).toEqual(["a", "b", "c"]);
  });
});
