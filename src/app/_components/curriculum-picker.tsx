import { useId, useMemo } from "react";
import { curriculumName } from "@/app/_lib/curricula";
import { count } from "@/app/_lib/format";
import type { AsioGroup, Curriculum, CurriculumGroup } from "@/app/_ports/ports";
import { Select } from "./select";
import { ghostButton, helper, label, secondaryButton } from "./styles";

/** The curricula of this search: a copy of a saved group, in its rank order. */
export type CurriculumChoice = { groupId: string; curricula: Curriculum[] };

export type CurriculumPickerProps = {
  /** The user's curriculum groups, null while they load, "failed" if they could not be loaded. */
  groups: CurriculumGroup[] | null | "failed";
  catalog: ReadonlyMap<string, AsioGroup>;
  value: CurriculumChoice | null;
  onChange: (next: CurriculumChoice | null) => void;
  onEdit: (group: CurriculumGroup | null) => void;
};

const byName = new Intl.Collator("et");
const tag = "rounded-full bg-subtle px-2 py-0.5 text-xs";

/** Point 1.3, optional: choose a saved curriculum group whose classes the event should not overlap (frame 01). */
export function CurriculumPicker({ groups, catalog, value, onChange, onEdit }: CurriculumPickerProps) {
  const id = useId();
  const sorted = useMemo(
    () => (Array.isArray(groups) ? [...groups].sort((a, b) => byName.compare(a.name, b.name)) : []),
    [groups],
  );
  const selected = sorted.find((g) => g.id === value?.groupId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <label htmlFor={`${id}-group`} className={label}>Salvestatud õppekavade grupp</label>
          <Select id={`${id}-group`} value={value?.groupId ?? ""} disabled={groups === null}
            aria-describedby={`${id}-group-help`}
            onChange={(e) => {
              const group = sorted.find((g) => g.id === e.target.value);
              onChange(group ? { groupId: group.id, curricula: structuredClone(group.curricula) } : null);
            }}>
            <option value="">{groups === null ? "Laen gruppe…" : "Õppekavu ei arvestata"}</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>{`${g.name} · ${count(g.curricula.length, "õppekava", "õppekava")}`}</option>
            ))}
          </Select>
        </div>
        <button type="button" className={secondaryButton} disabled={!selected} onClick={() => onEdit(selected)}>
          Muuda gruppi
        </button>
        <button type="button" className={`${ghostButton} h-10`} onClick={() => onEdit(null)}>
          + Uus grupp
        </button>
      </div>

      <p id={`${id}-group-help`} className={helper}>
        {groups === "failed"
          ? "Salvestatud gruppe ei õnnestunud laadida. Uue grupi saad siiski luua."
          : value
            ? "Järjestus tuleb grupist: 1. õppekava tunnid on kõige olulisem vältida. Muutmiseks vali „Muuda gruppi“."
            : groups?.length === 0
              ? "Sul pole veel õppekavade gruppe. Loo esimene nupuga „+ Uus grupp“, kui üritus ei tohi tundidega kattuda."
              : "Valikuline: vali grupp, kui üritus ei tohi nende õppekavade tundidega kattuda."}
      </p>

      {value && (
        <ol aria-label="Otsingu õppekavad" className="flex flex-col gap-2">
          {value.curricula.map((c, i) => (
            <li key={c.asioId} className="flex flex-wrap items-center gap-3 bg-page px-3 py-2 text-sm">
              <span className="w-6 font-semibold text-ink-muted">{i + 1}.</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {curriculumName(c, catalog)}
                <span className={tag}>{c.asioId}</span>
              </span>
              <span className={tag}>{c.courses?.length ? count(c.courses.length, "aine", "ainet") : "kõik ained"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
