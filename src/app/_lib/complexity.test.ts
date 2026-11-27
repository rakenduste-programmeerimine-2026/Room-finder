import { describe, expect, it } from "vitest";
import { changedWeights, DEFAULT_WEIGHTS, formatWeight, readWeight } from "./complexity";

describe("readWeight", () => {
  it.each<[string, number]>([
    ["0", 0],
    ["1", 1],
    ["0,7", 0.7],
    ["0.7", 0.7],
    [" 0,70 ", 0.7],
    ["0,456", 0.46],
    ["0,454", 0.45],
    ["0,145", 0.15],
    ["0,285", 0.29],
    ["0,005", 0.01],
    ["0,004", 0],
    [",5", 0.5],
    ["1,2", 1],
    ["5", 1],
    ["-0,1", 0],
    ["−0,1", 0],
    ["-0", 0],
  ])("reads %j as %d", (text, weight) => {
    expect(readWeight(text)).toBe(weight);
  });

  it.each(["", " ", "abc", "0,5,5", "1e-1", "0,5 kg", "--1"])("does not read %j", (text) => {
    expect(readWeight(text)).toBeNull();
  });

  it("never gives -0", () => {
    expect(Object.is(readWeight("-0,001"), 0)).toBe(true);
  });
});

describe("formatWeight", () => {
  it.each<[number, string]>([[1, "1,00"], [0.7, "0,70"], [0, "0,00"], [0.46, "0,46"]])("shows %d as %j", (w, text) => {
    expect(formatWeight(w)).toBe(text);
  });
});

describe("changedWeights", () => {
  it("sends nothing for the defaults", () => {
    expect(changedWeights(DEFAULT_WEIGHTS)).toEqual({});
  });

  it("sends only the weights that differ, including one set to 0", () => {
    expect(changedWeights({ ...DEFAULT_WEIGHTS, other: 0, university_permission: 0.25 })).toEqual({
      university_permission: 0.25,
      other: 0,
    });
  });
});
