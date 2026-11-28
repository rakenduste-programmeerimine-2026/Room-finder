import { describe, expect, it } from "vitest";
import type { Curriculum, CurriculumGroups } from "../ports";

/**
 * What the UI relies on from any CurriculumGroups adapter (#30), the same rules as for room
 * groups (#19). Each `make` call gives the port of a new user; names get a random suffix so a
 * shared database works too.
 */
export function curriculumGroupsContract(make: () => CurriculumGroups): void {
  const unique = (name: string) => `${name} ${crypto.randomUUID().slice(0, 8)}`;
  const curriculum = (asioId: string, change: Partial<Curriculum> = {}): Curriculum => ({
    asioId,
    university: "TLÜ",
    building: "Demo maja A",
    institute: "Demo digiinstituut",
    degreeLevel: "Bakalaureuseõpe",
    programme: "Demo informaatika",
    ...change,
  });
  const first = curriculum("DEMOINF-1");
  const second = curriculum("DEMOINF_ta-2", {
    specialisation: "Tarkvaraarendus",
    courses: [{ code: "DEMOINF_ta.001", name: "Demo testimine" }],
  });

  async function created(groups: CurriculumGroups, name: string, curricula: Curriculum[]) {
    const saved = await groups.create(name, curricula);
    if (!saved.ok) throw new Error(`could not create ${name}`);
    return saved.group;
  }

  describe("CurriculumGroups contract", () => {
    it("creates a group that the list then holds, curricula and courses in rank order", async () => {
      const groups = make();
      const name = unique("DTI bakalaureus");
      const group = await created(groups, name, [second, first]);

      expect(group).toMatchObject({ name, curricula: [second, first] });
      expect(group.id).not.toBe("");
      expect(await groups.list()).toContainEqual(group);
    });

    it("refuses a name the user already has, and changes nothing", async () => {
      const groups = make();
      const name = unique("DTI bakalaureus");
      await created(groups, name, [first]);
      const before = await groups.list();

      expect(await groups.create(name, [second])).toEqual({ ok: false, reason: "name_taken" });
      expect(await groups.list()).toEqual(before);
    });

    it("treats names that differ only in case as different, and lets a group keep its own name", async () => {
      const groups = make();
      const group = await created(groups, unique("DTI bakalaureus"), [first]);

      expect((await groups.create(group.name.toUpperCase(), [first])).ok).toBe(true);
      expect((await groups.update(group.id, group.name, [first, second])).ok).toBe(true);
    });

    it("overwrites a group and keeps its id, but refuses another group's name", async () => {
      const groups = make();
      const group = await created(groups, unique("DTI bakalaureus"), [first]);
      const other = await created(groups, unique("Meedia"), [second]);
      const changed = { id: group.id, name: unique("DTI bakalaureus + tarkvara"), curricula: [first, second] };

      expect(await groups.update(group.id, changed.name, changed.curricula)).toEqual({ ok: true, group: changed });
      expect(await groups.update(other.id, changed.name, [first])).toEqual({ ok: false, reason: "name_taken" });
      expect(await groups.list()).toEqual(expect.arrayContaining([changed, other]));
    });

    it("rejects an update of a group that does not exist", async () => {
      await expect(make().update(crypto.randomUUID(), unique("DTI"), [first])).rejects.toThrow();
    });

    it("does not show one user's groups to another", async () => {
      const name = unique("DTI bakalaureus");
      await created(make(), name, [first]);

      expect((await make().list()).map((g) => g.name)).not.toContain(name);
    });
  });
}
