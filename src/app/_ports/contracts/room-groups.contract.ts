import { describe, expect, it } from "vitest";
import type { RoomGroups } from "../ports";

/**
 * What the UI relies on from any RoomGroups adapter (#19). Each `make` call
 * gives the port of a new user; names get a random suffix so a shared
 * database works too.
 */
export function roomGroupsContract(make: () => RoomGroups): void {
  const unique = (name: string) => `${name} ${crypto.randomUUID().slice(0, 8)}`;

  async function created(groups: RoomGroups, name: string, roomCodes: string[]) {
    const saved = await groups.create(name, roomCodes);
    if (!saved.ok) throw new Error(`could not create ${name}`);
    return saved.group;
  }

  describe("RoomGroups contract", () => {
    it("creates a group that the list then holds, rooms in rank order", async () => {
      const groups = make();
      const name = unique("Aulad");
      const group = await created(groups, name, ["DEMO-301", "DEMO-101"]);

      expect(group).toMatchObject({ name, roomCodes: ["DEMO-301", "DEMO-101"] });
      expect(group.id).not.toBe("");
      expect(await groups.list()).toContainEqual(group);
    });

    it("refuses a name the user already has, and changes nothing", async () => {
      const groups = make();
      const name = unique("Aulad");
      await created(groups, name, ["DEMO-301"]);
      const before = await groups.list();

      expect(await groups.create(name, ["DEMO-101"])).toEqual({ ok: false, reason: "name_taken" });
      expect(await groups.list()).toEqual(before);
    });

    it("treats names that differ only in case as different, as the database does", async () => {
      const groups = make();
      const name = unique("Aulad");
      await created(groups, name, ["DEMO-301"]);

      expect((await groups.create(name.toUpperCase(), ["DEMO-301"])).ok).toBe(true);
    });

    it("renames and reorders a group and keeps its id", async () => {
      const groups = make();
      const group = await created(groups, unique("Aulad"), ["DEMO-301", "DEMO-101"]);
      const name = unique("Suured ruumid");
      const changed = { id: group.id, name, roomCodes: ["DEMO-101", "DEMO-301", "DEMO-201"] };

      expect(await groups.update(group.id, name, changed.roomCodes)).toEqual({ ok: true, group: changed });
      const list = await groups.list();
      expect(list).toContainEqual(changed);
      expect(list.filter((g) => g.id === group.id)).toHaveLength(1);
    });

    it("keeps a group's own name on update, but refuses another group's", async () => {
      const groups = make();
      const first = await created(groups, unique("Aulad"), ["DEMO-301"]);
      const second = await created(groups, unique("Klassid"), ["DEMO-101"]);

      expect((await groups.update(first.id, first.name, ["DEMO-201"])).ok).toBe(true);
      expect(await groups.update(second.id, first.name, ["DEMO-202"])).toEqual({ ok: false, reason: "name_taken" });
      expect(await groups.list()).toContainEqual(second);
    });

    it("rejects an update of a group that does not exist", async () => {
      await expect(make().update(crypto.randomUUID(), unique("Aulad"), ["DEMO-101"])).rejects.toThrow();
    });

    it("does not show one user's groups to another", async () => {
      const name = unique("Aulad");
      await created(make(), name, ["DEMO-301"]);

      expect((await make().list()).map((g) => g.name)).not.toContain(name);
    });
  });
}
