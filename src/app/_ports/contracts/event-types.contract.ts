import { describe, expect, it } from "vitest";
import type { EventTypes } from "../ports";

/** What the UI relies on from any EventTypes adapter. The backend runs it against its real adapter (#40). */
export function eventTypesContract(make: () => EventTypes): void {
  describe("EventTypes contract", () => {
    it("lists the most used types first", async () => {
      const counts = (await make().popular()).map((t) => t.useCount);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    it("gives each type once, trimmed, 1–60 characters, with a whole use count", async () => {
      const types = await make().popular();
      expect(new Set(types.map((t) => t.eventType.toLowerCase())).size).toBe(types.length);
      for (const { eventType, useCount } of types) {
        expect(eventType).toBe(eventType.trim());
        expect([...eventType].length).toBeGreaterThanOrEqual(1);
        expect([...eventType].length).toBeLessThanOrEqual(60);
        expect(Number.isInteger(useCount) && useCount >= 0).toBe(true);
      }
    });
  });
}
