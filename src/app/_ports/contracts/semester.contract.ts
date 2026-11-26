import { describe, expect, it } from "vitest";
import { formatTallinnTime } from "@/app/_lib/time/tallinn";
import type { Semester } from "../ports";

/**
 * What the UI relies on from any Semester adapter. The stub runs it in
 * stubs.test.ts; the backend runs it against its real adapter (#20).
 */
export function semesterContract(make: () => Semester): void {
  describe("Semester contract", () => {
    it("gives a UTC instant in the database format", async () => {
      expect(await make().nextStart()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it("gives the start of a local day (midnight in Tallinn)", async () => {
      expect(formatTallinnTime(await make().nextStart())).toBe("00:00");
    });
  });
}
