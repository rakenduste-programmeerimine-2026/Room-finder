import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { COMPLEXITY_LABELS, COMPLEXITY_ORDER } from "@/app/_lib/complexity";
import { count } from "@/app/_lib/format";
import { move } from "@/app/_lib/move";
import { checkRoomGroup, MAX_GROUP_NAME_LENGTH, MAX_GROUP_ROOMS, type GroupIssue } from "@/app/_lib/room-group";
import { NO_FILTER, searchRooms, type RoomFilter } from "@/app/_lib/room-search";
import { useBackend } from "@/app/_ports/backend";
import type { Complexity, Room, RoomGroup } from "@/app/_ports/ports";
import { RankedRoomList, RoomTags } from "./room-list";
import { Select } from "./select";
import { error, field, ghostButton, helper, label, primaryButton, secondaryButton } from "./styles";

export type RoomGroupEditorProps = {
  catalog: Room[];
  /** The group to change, or null for a new one. */
  group: RoomGroup | null;
  /** All of the user's room groups, to keep names unique. */
  groups: RoomGroup[];
  attendees: number | null;
  onSaved: (group: RoomGroup) => void;
  onCancel: () => void;
};

const nameTaken = (name: string) => `Nimi on juba kasutusel: sul on juba grupp nimega „${name}“. Vali teine nimi.`;

const MESSAGES: Record<GroupIssue, string> = {
  missing_name: "Anna grupile nimi.",
  name_too_long: `Nimi võib olla kuni ${MAX_GROUP_NAME_LENGTH} märki.`,
  name_taken: "Sul on juba sellise nimega ruumigrupp.",
  no_rooms: "Lisa gruppi vähemalt üks ruum.",
  too_many_rooms: `Grupis saab olla kuni ${MAX_GROUP_ROOMS} ruumi.`,
};

/** Point 1: find rooms by code or name variant, rank them and save the group (frame 02, US-003). */
export function RoomGroupEditor({ catalog, group, groups, attendees, onSaved, onCancel }: RoomGroupEditorProps) {
  const backend = useBackend();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [codes, setCodes] = useState<string[]>(group?.roomCodes ?? []);
  const [filter, setFilter] = useState<RoomFilter>(NO_FILTER);
  const [capacityText, setCapacityText] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => heading.current?.focus(), []);

  const byCode = useMemo(() => new Map(catalog.map((room) => [room.code, room])), [catalog]);
  const results = useMemo(() => searchRooms(catalog, filter), [catalog, filter]);
  const otherNames = (asNew: boolean) => groups.filter((g) => asNew || g.id !== group?.id).map((g) => g.name);
  const issues = checkRoomGroup(name, codes, otherNames(group === null)).issues;
  // An empty name or group is only an error once the user tries to save.
  const shown = issues.filter((i) => attempted || (i !== "missing_name" && i !== "no_rooms"));
  const nameIssue = shown.find((i) => i !== "no_rooms" && i !== "too_many_rooms");
  const roomsIssue = shown.find((i) => i === "no_rooms" || i === "too_many_rooms");
  const full = codes.length >= MAX_GROUP_ROOMS;
  const capacityInvalid = capacityText.trim() !== "" && !/^\d+$/.test(capacityText.trim());

  async function save(asNew: boolean) {
    const checked = checkRoomGroup(name, codes, otherNames(asNew));
    if (checked.issues.length) {
      setAttempted(true);
      toast.error(
        checked.issues.join() === "name_taken"
          ? nameTaken(checked.name)
          : `Gruppi ei salvestatud: ${checked.issues.map((i) => MESSAGES[i]).join(" ")}`,
      );
      return;
    }
    setSaving(true);
    try {
      const saved = asNew || !group
        ? await backend.roomGroups.create(checked.name, codes)
        : await backend.roomGroups.update(group.id, checked.name, codes);
      if (!saved.ok) {
        toast.error(nameTaken(checked.name));
        return;
      }
      toast.success(`Grupp salvestatud: „${saved.group.name}“ on nüüd valikus.`);
      onSaved(saved.group);
    } catch {
      toast.error("Gruppi ei õnnestunud salvestada. Sinu muudatused on alles, proovi uuesti.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">Uus otsing · Ruumid</p>
        <h1 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-3xl font-normal focus:outline-none">
          {group ? `Ruumigrupp: ${group.name}` : "Uus ruumigrupp"}
        </h1>
        <p className="text-sm text-ink-muted">
          Lisa ruumid gruppi ja järjesta need. Grupp salvestub selle brauseri anonüümse sessiooni alla.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby={`${id}-find`} className="flex flex-col gap-4 bg-layer p-6">
          <h2 id={`${id}-find`} className="text-xl font-normal">Leia ruum</h2>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-query`} className={label}>Otsi koodi või nime järgi</label>
            <input id={`${id}-query`} type="search" autoComplete="off" value={filter.query} className={field}
              aria-describedby={`${id}-query-help`} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
            <p id={`${id}-query-help`} className={helper}>
              Otsib koodi ja nimevariantide järgi, tühikuid ja sidekriipse arvestamata.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-capacity`} className={label}>Mahutavus vähemalt</label>
              <input id={`${id}-capacity`} type="text" inputMode="numeric" autoComplete="off" value={capacityText}
                className={field} aria-invalid={capacityInvalid} aria-describedby={`${id}-capacity-message`}
                onChange={(e) => {
                  const text = e.target.value;
                  setCapacityText(text);
                  setFilter({ ...filter, minCapacity: /^\d+$/.test(text.trim()) ? Number(text.trim()) : null });
                }} />
              <p id={`${id}-capacity-message`} className={capacityInvalid ? error : helper}>
                {capacityInvalid ? "Sisesta täisarv. Seni näidatakse kõiki ruume." : "Tühi = kõik ruumid."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-complexity`} className={label}>Keerukusklass</label>
              <Select id={`${id}-complexity`} value={filter.complexity}
                onChange={(e) => setFilter({ ...filter, complexity: e.target.value as Complexity | "all" })}>
                <option value="all">Kõik</option>
                {COMPLEXITY_ORDER.map((c) => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filter.teachingOnly} className="size-4 accent-interactive"
              onChange={(e) => setFilter({ ...filter, teachingOnly: e.target.checked })} />
            Ainult õppetööks broneeritavad
          </label>

          <p role="status" className={helper}>Leitud ruume: {results.length}</p>
          <ul aria-label="Leitud ruumid" className="flex flex-col gap-2">
            {results.map((room) => {
              const added = codes.includes(room.code);
              return (
                <li key={room.code} className={`flex items-center gap-3 px-3 py-2 ${added ? "bg-subtle" : "bg-page"}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{room.code}</span>
                    <span className="truncate text-xs text-ink-muted">{room.aliases.join(" · ")}</span>
                  </span>
                  <RoomTags room={room} attendees={attendees} />
                  {added ? (
                    <span className="w-20 text-center text-sm text-interactive">Grupis</span>
                  ) : (
                    <button type="button" className={`${ghostButton} w-20`} disabled={full}
                      aria-label={`Lisa ${room.code} gruppi`} onClick={() => setCodes([...codes, room.code])}>
                      + Lisa
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby={`${id}-group`} className="flex flex-col gap-4 bg-layer p-6">
          <h2 id={`${id}-group`} className="text-xl font-normal">Grupp</h2>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className={label}>Grupi nimi</label>
            <input id={`${id}-name`} type="text" autoComplete="off" value={name} className={field}
              aria-required="true" aria-invalid={nameIssue !== undefined} aria-describedby={`${id}-name-message`}
              onChange={(e) => setName(e.target.value)} />
            <p id={`${id}-name-message`} className={nameIssue ? error : helper}>
              {nameIssue ? MESSAGES[nameIssue] : `Nimi on sinu gruppide seas unikaalne (1–${MAX_GROUP_NAME_LENGTH} märki).`}
            </p>
          </div>

          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Eelisjärjestus</h3>
            <span className="text-xs text-ink-muted">{count(codes.length, "ruum", "ruumi")} · max {MAX_GROUP_ROOMS}</span>
          </div>
          <p className={roomsIssue ? error : helper}>
            {roomsIssue ? MESSAGES[roomsIssue] : "Lohista ridu või kasuta nooli. 1. ruum on kõige eelistatum."}
          </p>
          <RankedRoomList label="Grupi ruumid" codes={codes} catalog={byCode} attendees={attendees}
            onMove={(from, to) => setCodes(move(codes, from, to))}
            onRemove={(index) => setCodes(codes.filter((_, i) => i !== index))} />

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className={primaryButton} disabled={saving} onClick={() => save(false)}>
              Salvesta grupp
            </button>
            {group && (
              <button type="button" className={secondaryButton} disabled={saving} onClick={() => save(true)}>
                Salvesta uue nimega
              </button>
            )}
            <button type="button" className={`${ghostButton} ml-auto h-10`} disabled={saving} onClick={onCancel}>
              Tühista
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
