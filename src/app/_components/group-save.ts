import { toast } from "react-toastify";
import { checkGroup, type GroupIssue } from "@/app/_lib/saved-group";
import type { GroupSave } from "@/app/_ports/ports";

/** The part of the RoomGroups or CurriculumGroups port that saves. */
type SavingPort<T, G> = {
  create(name: string, items: T[]): Promise<GroupSave<G>>;
  update(id: string, name: string, items: T[]): Promise<GroupSave<G>>;
};

export type GroupToSave<T> = {
  /** The group to overwrite, or null to save a new one. */
  id: string | null;
  name: string;
  items: T[];
  /** The names of the user's other groups of this kind. */
  otherNames: string[];
  messages: Record<GroupIssue, string>;
};

const nameTaken = (name: string) => `Nimi on juba kasutusel: sul on juba grupp nimega „${name}“. Vali teine nimi.`;

/**
 * Checks and saves a room or curriculum group and says in a toast how it went (US-003, US-009).
 * Resolves with the saved group, or null when nothing was saved: the editor then keeps the changes.
 */
export async function saveGroup<T, G extends { name: string }>(
  port: SavingPort<T, G>,
  { id, name, items, otherNames, messages }: GroupToSave<T>,
): Promise<G | null> {
  const checked = checkGroup(name, items.length, otherNames);
  if (checked.issues.length) {
    toast.error(
      checked.issues.join() === "name_taken"
        ? nameTaken(checked.name)
        : `Gruppi ei salvestatud: ${checked.issues.map((i) => messages[i]).join(" ")}`,
    );
    return null;
  }
  try {
    const saved = id === null ? await port.create(checked.name, items) : await port.update(id, checked.name, items);
    if (!saved.ok) {
      toast.error(nameTaken(checked.name));
      return null;
    }
    toast.success(`Grupp salvestatud: „${saved.group.name}“ on nüüd valikus.`);
    return saved.group;
  } catch {
    toast.error("Gruppi ei õnnestunud salvestada. Sinu muudatused on alles, proovi uuesti.");
    return null;
  }
}
