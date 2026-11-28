import { COMPLEXITY_LABELS } from "@/app/_lib/complexity";
import { count } from "@/app/_lib/format";
import type { Room } from "@/app/_ports/ports";
import { RankedList } from "./ranked-list";

const tag = "rounded-full bg-subtle px-2 py-0.5 text-xs text-ink";

/** The facts about a room the organiser chooses by: capacity, teaching use, complexity class. */
export function RoomTags({ room, attendees }: { room: Room; attendees: number | null }) {
  const tooSmall = attendees !== null && room.capacity < attendees;
  return (
    <span className="flex flex-wrap gap-1">
      <span className={tooSmall ? "rounded-full bg-error px-2 py-0.5 text-xs text-white" : tag}>
        {count(room.capacity, "koht", "kohta")}{tooSmall ? " · liiga väike" : ""}
      </span>
      {room.bookableForTeaching && <span className={tag}>Õppetöö</span>}
      <span className={tag}>{COMPLEXITY_LABELS[room.complexity]}</span>
    </span>
  );
}

export type RankedRoomListProps = {
  /** The accessible name of the list. */
  label: string;
  /** Room codes in rank order. */
  codes: string[];
  catalog: ReadonlyMap<string, Room>;
  attendees: number | null;
  onMove: (from: number, to: number) => void;
  /** Without it, rooms cannot be removed. */
  onRemove?: (index: number) => void;
};

/** A ranked list of rooms by code, with their name variants and tags (US-003). */
export function RankedRoomList({ codes, catalog, attendees, ...list }: RankedRoomListProps) {
  return (
    <RankedList items={codes} nameOf={(code) => code} {...list}>
      {(code) => {
        const room = catalog.get(code);
        return (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{code}</span>
              <span className="truncate text-xs text-ink-muted">
                {room ? room.aliases.join(" · ") : "Ruumi ei leitud kataloogist"}
              </span>
            </span>
            {room && <RoomTags room={room} attendees={attendees} />}
          </>
        );
      }}
    </RankedList>
  );
}
