import { describe, expect, it } from "vitest";
import { buildTimeWindows } from "@/app/_lib/time/time-windows";
import type { SearchInput, Searches, SearchStatus } from "../ports";

/**
 * What the UI relies on from any Searches adapter (#23). Each `make` call gives
 * the port of a new user. A real search takes a while, so `pause` is the time
 * in milliseconds between status checks and `checks` how many are made. Only
 * what the UI can see is checked: the first status may already be "done".
 */
export function searchesContract(make: () => Searches, { pause = 1000, checks = 120 } = {}): void {
  const timeout = pause * checks + 10_000;
  // Two days two weeks ahead, so that the fixture never lies in the past.
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const built = buildTimeWindows(
    [
      { date: day(14), ranges: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
      { date: day(15), ranges: [{ start: "09:00", end: "18:00" }] },
    ],
    90,
  );
  if (!built.ok) throw new Error("the fixture's time windows are invalid");
  const input: SearchInput = {
    name: null,
    eventType: "koosolek",
    durationMinutes: 90,
    attendees: 10,
    roomCodes: ["DEMO-103", "DEMO-101", "DEMO-201"],
    roomGroupId: null,
    complexityWeights: {},
    timeWindows: built.windows,
    curricula: null,
    curriculumGroupId: null,
    csvFilename: null,
  };
  const ranges = built.windows.flatMap((period) => period.days.flatMap((day) => day.ranges));

  async function finished(searches: Searches, id: string): Promise<SearchStatus> {
    for (let i = 0; i < checks; i++) {
      const status = await searches.status(id);
      if (status.status === "done" || status.status === "failed") return status;
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
    throw new Error(`search ${id} did not finish`);
  }

  describe("Searches contract", () => {
    it("gives every search its own id", async () => {
      const searches = make();
      const first = await searches.start(input);
      const second = await searches.start(input);

      expect(first).not.toBe("");
      expect(second).not.toBe(first);
    });

    it("finishes with a time in one of the rooms and ranges, as long as the event", async () => {
      const searches = make();
      const status = await finished(searches, await searches.start(input));
      if (status.status !== "done") throw new Error(`expected done, got ${JSON.stringify(status)}`);
      const { best, unsuitableGroups, warnings } = status.result;
      if (!best) throw new Error("expected a best time");

      expect(input.roomCodes).toContain(best.roomCode);
      expect(best.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(Date.parse(best.end) - Date.parse(best.start)).toBe(90 * 60_000);
      expect(ranges.some((r) => r.start <= best.start && best.end <= r.end)).toBe(true);
      expect(unsuitableGroups).toEqual([]); // no curricula were chosen
      expect(Array.isArray(warnings)).toBe(true);
    }, timeout);

    it("names only the search's curricula as unsuitable, each with class times that overlap the best time", async () => {
      const searches = make();
      const curriculum = (asioId: string) => ({
        asioId,
        university: "TLÜ",
        building: "Demo maja A",
        institute: "Demo digiinstituut",
        degreeLevel: "Bakalaureuseõpe",
        programme: "Demo informaatika",
      });
      const curricula = [curriculum("DEMOINF-1"), curriculum("DEMOINF-2")];
      const status = await finished(searches, await searches.start({ ...input, curricula }));
      if (status.status !== "done" || !status.result.best) throw new Error(`expected a best time, got ${JSON.stringify(status)}`);
      const { best, unsuitableGroups } = status.result;

      for (const group of unsuitableGroups) {
        expect(curricula.map((c) => c.asioId)).toContain(group.curriculum.asioId);
        expect(group.conflicts.length).toBeGreaterThan(0);
        for (const c of group.conflicts) expect(c.start < best.end && best.start < c.end).toBe(true);
      }
    }, timeout);

    // UI-11 (working assumption): rooms below the attendee count are left out.
    it("finds nothing when no room holds the attendees", async () => {
      const searches = make();
      const status = await finished(searches, await searches.start({ ...input, attendees: 10_000 }));

      expect(status).toMatchObject({ status: "done", result: { best: null } });
    }, timeout);

    it("rejects an unknown id and another user's search", async () => {
      const searches = make();
      const id = await searches.start(input);

      await expect(searches.status(crypto.randomUUID())).rejects.toThrow();
      await expect(make().status(id)).rejects.toThrow();
    });
  });
}
