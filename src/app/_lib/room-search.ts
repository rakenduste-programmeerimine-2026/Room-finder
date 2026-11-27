import type { Complexity, Room } from "@/app/_ports/ports";

export type RoomFilter = {
  query: string;
  minCapacity: number | null;
  complexity: Complexity | "all";
  teachingOnly: boolean;
};

export const NO_FILTER: RoomFilter = { query: "", minCapacity: null, complexity: "all", teachingOnly: false };

/**
 * Text for matching: lower case, without spaces and punctuation, so "a 543", "A-543"
 * and "a543" match. Letters stay as they are: õ, ä, ö and ü are letters of their own in Estonian.
 */
const fold = (text: string): string => text.toLocaleLowerCase("et").replace(/[^\p{L}\p{N}]/gu, "");

const byCode = new Intl.Collator("et", { numeric: true });

/** Rooms whose code or any name variant contains the query and that pass the filters, by code. */
export function searchRooms(rooms: readonly Room[], filter: RoomFilter): Room[] {
  const query = fold(filter.query);
  return rooms
    .filter(
      (room) =>
        (!query || [room.code, ...room.aliases].some((text) => fold(text).includes(query))) &&
        (filter.minCapacity === null || room.capacity >= filter.minCapacity) &&
        (filter.complexity === "all" || room.complexity === filter.complexity) &&
        (!filter.teachingOnly || room.bookableForTeaching),
    )
    .sort((a, b) => byCode.compare(a.code, b.code));
}
