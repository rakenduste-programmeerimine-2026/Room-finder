import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [5, "5 min"],
    [59, "59 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [1440, "24 h"],
  ])("%i minutes → %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});
