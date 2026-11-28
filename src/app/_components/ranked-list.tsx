import { useState, type DragEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Close } from "./icons";
import { iconButton } from "./styles";

export type RankedListProps<T> = {
  /** The accessible name of the list. */
  label: string;
  /** In rank order. */
  items: readonly T[];
  /** An item's unique short name, such as a room code: the row's key and the start of its button labels. */
  nameOf: (item: T) => string;
  /** What a row shows between its rank and its buttons. */
  children: (item: T, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** Without it, items cannot be removed. */
  onRemove?: (index: number) => void;
};

/** A ranked list: drag a row, or use the arrow buttons, to change the order (US-003, US-009). */
export function RankedList<T>({ label, items, nameOf, children, onMove, onRemove }: RankedListProps<T>) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const announce = (text: string) => setAnnouncement((a) => ({ text, count: a.count + 1 }));
  const move = (from: number, to: number) => {
    onMove(from, to);
    announce(`${nameOf(items[from])} on nüüd ${to + 1}. kohal.`);
  };

  const dragProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragged(index);
      e.dataTransfer?.setData("text/plain", nameOf(items[index])); // Firefox starts a drag only with data
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
        {items.map((item, i) => {
          const name = nameOf(item);
          return (
            <li key={name} {...dragProps(i)}
              className={`flex cursor-grab items-start gap-3 bg-page px-3 py-2 ${dragged === i ? "opacity-50" : ""}`}>
              <span className="w-6 pt-1.5 font-semibold text-ink-muted">{i + 1}.</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-1">{children(item, i)}</span>
              <span className="flex items-center">
                <button type="button" className={iconButton} aria-label={`${name}: liiguta üles`} disabled={i === 0}
                  onClick={() => move(i, i - 1)}>
                  <ChevronUp />
                </button>
                <button type="button" className={iconButton} aria-label={`${name}: liiguta alla`}
                  disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  <ChevronDown />
                </button>
                {onRemove && (
                  <button type="button" className={iconButton} aria-label={`${name}: eemalda grupist`}
                    onClick={() => { onRemove(i); announce(`${name} eemaldati.`); }}>
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
