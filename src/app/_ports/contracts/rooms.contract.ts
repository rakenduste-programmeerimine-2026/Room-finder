import { describe, expect, it } from "vitest";
import { COMPLEXITIES, type Rooms } from "../ports";

/** What the UI relies on from any Rooms adapter. The backend runs it against its real adapter (#40). */
export function roomsContract(make: () => Rooms): void {
  describe("Rooms contract", () => {
    it("lists rooms with unique codes", async () => {
      const rooms = await make().list();
      expect(rooms.length).toBeGreaterThan(0);
      expect(new Set(rooms.map((r) => r.code)).size).toBe(rooms.length);
    });

    it("gives every room the fields the editor shows, within the database limits", async () => {
      for (const room of await make().list()) {
        expect(room.code).toMatch(/^\S(.{0,30}\S)?$/);
        expect(Number.isInteger(room.capacity) && room.capacity > 0).toBe(true);
        expect(typeof room.bookableForTeaching).toBe("boolean");
        expect(COMPLEXITIES).toContain(room.complexity);
        for (const text of [...room.aliases, ...room.eventTypes]) {
          expect(text).toBe(text.trim());
          expect(text).not.toBe("");
        }
      }
    });
  });
}
