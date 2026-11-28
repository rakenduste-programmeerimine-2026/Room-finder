import { describe, expect, it } from "vitest";
import { charLength } from "@/app/_lib/text";
import type { Curricula } from "../ports";

/**
 * What the UI relies on from any Curricula adapter (#30): ASIO groups with the fields a saved
 * curriculum keeps (data model 5.2) within the database's limits, one group per code.
 */
export function curriculaContract(make: () => Curricula): void {
  describe("Curricula contract", () => {
    it("lists groups, each code once", async () => {
      const groups = await make().list();
      const codes = groups.map((g) => g.asioId);

      expect(groups.length).toBeGreaterThan(0);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("gives every group the fields of a saved curriculum, within the database's limits", async () => {
      for (const group of await make().list()) {
        for (const text of [group.university, group.building, group.institute, group.degreeLevel, group.programme]) {
          expect(charLength(text)).toBeGreaterThanOrEqual(1);
          expect(charLength(text)).toBeLessThanOrEqual(200);
        }
        if (group.specialisation !== undefined) expect(charLength(group.specialisation)).toBeLessThanOrEqual(200);
        expect(charLength(group.asioId)).toBeGreaterThanOrEqual(1);
        expect(charLength(group.asioId)).toBeLessThanOrEqual(64);
        expect(group.name.trim()).not.toBe("");
        expect(group.programmeCode.trim()).not.toBe("");
      }
    });

    it("lists each group's courses once, at most 200, within the limits", async () => {
      for (const group of await make().list()) {
        const codes = group.courses.map((c) => c.code);
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes.length).toBeLessThanOrEqual(200);
        for (const course of group.courses) {
          expect(charLength(course.code)).toBeLessThanOrEqual(64);
          expect(charLength(course.name)).toBeGreaterThanOrEqual(1);
          expect(charLength(course.name)).toBeLessThanOrEqual(200);
        }
      }
    });
  });
}
