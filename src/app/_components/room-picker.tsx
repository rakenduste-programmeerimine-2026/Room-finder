import { useId, useMemo } from "react";
import { count } from "@/app/_lib/format";
import { move } from "@/app/_lib/move";
import type { Room, RoomGroup } from "@/app/_ports/ports";
import { RankedRoomList } from "./room-list";
import { Select } from "./select";
import { ghostButton, helper, label, secondaryButton } from "./styles";

/** The rooms of this search: a copy of a saved group, which the user may reorder for this search only. */
export type RoomChoice = { groupId: string; roomCodes: string[] };

export type RoomPickerProps = {
  /** The user's room groups, null while they load, "failed" if they could not be loaded. */
  groups: RoomGroup[] | null | "failed";
  catalog: Room[];
  value: RoomChoice | null;
  onChange: (next: RoomChoice | null) => void;
  attendees: number | null;
  onEdit: (group: RoomGroup | null) => void;
};

const byName = new Intl.Collator("et");

/** Point 1: choose a saved room group and rank its rooms for this search (frame 01, card "Ruumid"). */
export function RoomPicker({ groups, catalog, value, onChange, attendees, onEdit }: RoomPickerProps) {
  const id = useId();
  const sorted = useMemo(
    () => (Array.isArray(groups) ? [...groups].sort((a, b) => byName.compare(a.name, b.name)) : []),
    [groups],
  );
  const byCode = useMemo(() => new Map(catalog.map((room) => [room.code, room])), [catalog]);
  const selected = sorted.find((g) => g.id === value?.groupId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <label htmlFor={`${id}-group`} className={label}>Salvestatud ruumigrupp</label>
          <Select id={`${id}-group`} value={value?.groupId ?? ""} disabled={groups === null}
            aria-describedby={`${id}-group-help`}
            onChange={(e) => {
              const group = sorted.find((g) => g.id === e.target.value);
              onChange(group ? { groupId: group.id, roomCodes: [...group.roomCodes] } : null);
            }}>
            <option value="">{groups === null ? "Laen gruppe…" : "Vali ruumigrupp"}</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>{`${g.name} · ${count(g.roomCodes.length, "ruum", "ruumi")}`}</option>
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
          : groups?.length === 0
          ? "Sul pole veel ruumigruppe. Loo esimene nupuga „+ Uus grupp“."
          : value
            ? "Eelisjärjestus: lohista ridu või kasuta nooli. Esimene on kõige eelistatum. Järjestus kehtib sellele otsingule; grupi enda muutmiseks vali „Muuda gruppi“."
            : "Vali grupp, mille ruumide seast aega otsida."}
      </p>

      {value && (
        <RankedRoomList label="Otsingu ruumid" codes={value.roomCodes} catalog={byCode} attendees={attendees}
          onMove={(from, to) => onChange({ ...value, roomCodes: move(value.roomCodes, from, to) })} />
      )}
    </div>
  );
}
