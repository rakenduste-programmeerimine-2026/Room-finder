import { describe, expect, it } from "vitest";
import type { Room } from "@/app/_ports/ports";
import { NO_FILTER, searchRooms, type RoomFilter } from "./room-search";

const room = (code: string, aliases: string[], change: Partial<Room> = {}): Room => ({
  code,
  aliases,
  capacity: 20,
  bookableForTeaching: false,
  complexity: "other",
  eventTypes: [],
  ...change,
});

const ROOMS = [
  room("A-543", ["Astra 543", "Aula"]),
  room("A-002", ["Astra 002 – Aula konverentsisaal"], { capacity: 120, complexity: "university_permission" }),
  room("M-648", ["Mare 648 – Väike aula"], { capacity: 40, bookableForTeaching: true }),
  room("N-102", ["Nova 102"], { capacity: 8 }),
  room("T-10", ["Terra 10 – Õpperuum"], { bookableForTeaching: true }),
  room("T-9", ["Terra 9"]),
];

const codes = (filter: Partial<RoomFilter>) => searchRooms(ROOMS, { ...NO_FILTER, ...filter }).map((r) => r.code);

describe("searchRooms", () => {
  it("lists every room by code, numbers in numeric order, without a query", () => {
    expect(codes({})).toEqual(["A-002", "A-543", "M-648", "N-102", "T-9", "T-10"]);
  });

  it("finds a room by code or any name variant, each room once", () => {
    expect(codes({ query: "aula" })).toEqual(["A-002", "A-543", "M-648"]);
  });

  it.each(["A-543", "a543", "a 543", "Astra 543", "astra-543", "  ASTRA543 "])("finds A-543 by %j", (query) => {
    expect(codes({ query })).toContain("A-543");
  });

  it("keeps õ, ä, ö and ü apart from o, a and u", () => {
    expect(codes({ query: "õpperuum" })).toEqual(["T-10"]);
    expect(codes({ query: "opperuum" })).toEqual([]);
    expect(codes({ query: "väike" })).toEqual(["M-648"]);
    expect(codes({ query: "vaike" })).toEqual([]);
  });

  it("finds nothing for an unknown text", () => {
    expect(codes({ query: "kohvik" })).toEqual([]);
  });

  it("keeps rooms with at least the given capacity, the boundary included", () => {
    expect(codes({ minCapacity: 40 })).toEqual(["A-002", "M-648"]);
    expect(codes({ minCapacity: 41 })).toEqual(["A-002"]);
  });

  it("filters by complexity class and by teaching use", () => {
    expect(codes({ complexity: "university_permission" })).toEqual(["A-002"]);
    expect(codes({ teachingOnly: true })).toEqual(["M-648", "T-10"]);
  });

  it("combines the query and the filters", () => {
    expect(codes({ query: "aula", minCapacity: 30, teachingOnly: true })).toEqual(["M-648"]);
  });
});
