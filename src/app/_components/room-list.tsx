import { useState, type DragEvent } from "react";
import { COMPLEXITY_LABELS } from "@/app/_lib/complexity";
import { count } from "@/app/_lib/format";
import type { Room } from "@/app/_ports/ports";
import { ChevronDown, ChevronUp, Close } from "./icons";
import { iconButton } from "./styles";

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

/** A ranked list of rooms: drag a row, or use the arrow buttons, to change the order (US-003). */
export function RankedRoomList({ label, codes, catalog, attendees, onMove, onRemove }: RankedRoomListProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const announce = (text: string) => setAnnouncement((a) => ({ text, count: a.count + 1 }));
  const move = (from: number, to: number) => {
    onMove(from, to);
    announce(`${codes[from]} on nüüd ${to + 1}. kohal.`);
  };

  const dragProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragged(index);
      e.dataTransfer?.setData("text/plain", codes[index]); // Firefox starts a drag only with data
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => {
      if (dragged !== null) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragged !== null && dragged !== index) move(dragged, index);
      setDragged(null);
    },
    onDragEnd: () => setDragged(null),
  });

  return (
    <>
      <ol aria-label={label} className="flex flex-col gap-2">
        {codes.map((code, i) => {
          const room = catalog.get(code);
          return (
            <li key={code} {...dragProps(i)}
              className={`flex cursor-grab items-center gap-3 bg-page px-3 py-2 ${dragged === i ? "opacity-50" : ""}`}>
              <span className="w-6 font-semibold text-ink-muted">{i + 1}.</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{code}</span>
                <span className="truncate text-xs text-ink-muted">
                  {room ? room.aliases.join(" · ") : "Ruumi ei leitud kataloogist"}
                </span>
              </span>
              {room && <RoomTags room={room} attendees={attendees} />}
              <span className="flex items-center">
                <button type="button" className={iconButton} aria-label={`${code}: liiguta üles`} disabled={i === 0}
                  onClick={() => move(i, i - 1)}>
                  <ChevronUp />
                </button>
                <button type="button" className={iconButton} aria-label={`${code}: liiguta alla`}
                  disabled={i === codes.length - 1} onClick={() => move(i, i + 1)}>
                  <ChevronDown />
                </button>
                {onRemove && (
                  <button type="button" className={iconButton} aria-label={`${code}: eemalda grupist`}
                    onClick={() => { onRemove(i); announce(`${code} eemaldati.`); }}>
                    <Close />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement.text}
        {announcement.count % 2 ? " " : ""}
      </p>
    </>
  );
}
