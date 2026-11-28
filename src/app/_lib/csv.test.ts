import { describe, expect, it } from "vitest";
import { candidateTimes, csvFileProblem, MAX_CSV_BYTES, MAX_PERIODS, NO_CSV, type CsvState } from "./csv";
import type { Period } from "./time/time-windows";

const period = (day: number, source: Period["source"] = "tool"): Period => {
  const start = `2026-12-${String(day).padStart(2, "0")}T`;
  return {
    source,
    start: `${start}00:00:00Z`,
    end: `${start}23:00:00Z`,
    days: [{ start: `${start}00:00:00Z`, end: `${start}23:00:00Z`, ranges: [{ start: `${start}08:00:00Z`, end: `${start}10:00:00Z` }] }],
  };
};
const manual = [period(1)];
const accepted: CsvState = { state: "accepted", name: "ajad.csv", rows: 2, windows: [period(8, "csv"), period(9, "csv")] };

describe("csvFileProblem", () => {
  it.each([
    ["ajad.csv", 0, null],
    ["AJAD.CSV", MAX_CSV_BYTES, null],
    ["ajad.csv", MAX_CSV_BYTES + 1, "too_large"],
    ["ajad.xlsx", 10, "not_csv"],
    ["ajad.csv.txt", 10, "not_csv"],
    ["csv", 10, "not_csv"],
  ])("%s of %i bytes: %s", (name, size, problem) => {
    expect(csvFileProblem({ name, size })).toBe(problem);
  });

  it("counts 1 MB as 1 048 576 bytes", () => {
    expect(MAX_CSV_BYTES).toBe(1024 * 1024);
  });
});

describe("candidateTimes", () => {
  it("sends the manual times without a CSV file, or says they are missing", () => {
    expect(candidateTimes(manual, NO_CSV, true)).toEqual({ ok: true, windows: manual, csvFilename: null });
    expect(candidateTimes(null, NO_CSV, true)).toEqual({ ok: false, issue: "missing" });
  });

  it("holds the search while a file is being checked", () => {
    expect(candidateTimes(manual, { state: "checking", name: "ajad.csv" }, true)).toEqual({ ok: false, issue: "checking" });
  });

  it("sends the manual periods first and then the file's, when used together", () => {
    expect(candidateTimes(manual, accepted, true)).toEqual({
      ok: true,
      windows: [manual[0], ...(accepted.state === "accepted" ? accepted.windows : [])],
      csvFilename: "ajad.csv",
    });
  });

  it("sends only the file's periods instead of the manual ones", () => {
    const result = candidateTimes(manual, accepted, false);
    expect(result.ok && result.windows.map((p) => p.source)).toEqual(["csv", "csv"]);
    expect(candidateTimes(null, accepted, false)).toMatchObject({ ok: true, csvFilename: "ajad.csv" });
  });

  it("asks to fix the manual times when they are to be used together but have problems", () => {
    expect(candidateTimes(null, accepted, true)).toEqual({ ok: false, issue: "manual_invalid" });
  });

  it("does not use a rejected file", () => {
    const rejected: CsvState = { state: "rejected", name: "vana.csv", errors: [{ row: 4, message: "x" }] };
    expect(candidateTimes(manual, rejected, true)).toEqual({ ok: true, windows: manual, csvFilename: null });
    expect(candidateTimes(null, rejected, true)).toEqual({ ok: false, issue: "missing" });
  });

  it.each([
    [MAX_PERIODS, true],
    [MAX_PERIODS + 1, false],
  ])("allows %i periods in all: %s", (n, ok) => {
    const csv: CsvState = { state: "accepted", name: "suur.csv", rows: n, windows: Array.from({ length: n - 1 }, (_, i) => period((i % 28) + 1, "csv")) };
    expect(candidateTimes(manual, csv, true).ok).toBe(ok);
  });

  it("refuses windows longer than the JSON limit, even under 50 periods", () => {
    const big = period(1);
    big.days[0].ranges = Array.from({ length: 200 }, () => big.days[0].ranges[0]);
    const csv: CsvState = { state: "accepted", name: "suur.csv", rows: 4000, windows: Array.from({ length: 20 }, () => big) };
    expect(JSON.stringify(csv.state === "accepted" && csv.windows).length).toBeGreaterThan(240_000);
    expect(candidateTimes(null, csv, false)).toEqual({ ok: false, issue: "too_large" });
  });
});
