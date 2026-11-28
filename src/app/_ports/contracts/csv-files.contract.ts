import { describe, expect, it } from "vitest";
import type { CsvCheck, CsvFiles } from "../ports";

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Checks that an answer has the shape the UI reads, whatever the backend decides about the file. */
function expectWellFormed(answer: CsvCheck) {
  if (!answer.ok) {
    expect(answer.errors.length).toBeGreaterThan(0);
    for (const error of answer.errors) {
      expect(Number.isInteger(error.row) && error.row >= 1).toBe(true);
      expect(error.message.trim()).not.toBe("");
    }
    return;
  }
  expect(Number.isInteger(answer.rows) && answer.rows >= 1).toBe(true);
  expect(answer.timeWindows.length).toBeGreaterThan(0);
  const inside = (child: { start: string; end: string }, parent: { start: string; end: string }) =>
    parent.start <= child.start && child.end <= parent.end;
  for (const period of answer.timeWindows) {
    expect(period.source).toBe("csv");
    for (const day of period.days) {
      expect(inside(day, period)).toBe(true);
      for (const range of day.ranges) {
        expect(range.start).toMatch(UTC_INSTANT);
        expect(range.end).toMatch(UTC_INSTANT);
        expect(range.start < range.end).toBe(true);
        expect(inside(range, day)).toBe(true);
      }
    }
  }
}

/**
 * What the UI relies on from any CsvFiles adapter (#31, UI-8). The file format is the backend's
 * (data model Q2, unconfirmed), so only the shape of the answer is checked, for a file in the
 * format of the help text and for one with a range that ends before it starts.
 */
export function csvFilesContract(make: () => CsvFiles): void {
  const file = (name: string, text: string) => new File([text], name, { type: "text/csv" });

  describe("CsvFiles contract", () => {
    it("answers a file in the help text's format with CSV periods or with row errors", async () => {
      const answer = await make().check(
        file("ajad.csv", "date,start,end\n2026-12-08,08:00:00Z,10:00:00Z\n2026-12-08,11:00:00Z,14:00:00Z\n"),
      );
      expectWellFormed(answer);
    });

    it("answers a file with a bad row in the same shape", async () => {
      expectWellFormed(await make().check(file("ajad-viga.csv", "date,start,end\n2026-12-08,10:00:00Z,08:00:00Z\n")));
    });
  });
}
