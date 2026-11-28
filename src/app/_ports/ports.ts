import type { UtcInstant } from "@/app/_lib/time/tallinn";
import type { Interval, TimeWindows } from "@/app/_lib/time/time-windows";

/**
 * What the UI needs from the backend. One small interface per capability; the
 * backend role writes the real adapters, which must pass the suites in
 * ./contracts. Ports are added as their UI issues start. Arguments and results
 * are plain, serialisable data, so a Server Action can implement a method.
 */

/** The next semester, for the warning in point 1.2 (#26, #20). */
export interface Semester {
  /** When the next semester begins: the UTC instant of local midnight on its first day. */
  nextStart(): Promise<UtcInstant>;
}

/** How hard a room is to get (`room_acquisition_complexity`, data model 4.1). */
export const COMPLEXITIES = [
  "google_form",
  "institute_permission",
  "university_permission",
  "contact_owner",
  "other",
] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

/** A room in the catalogue (`rooms`, data model 4.1). */
export type Room = {
  code: string;
  capacity: number;
  bookableForTeaching: boolean;
  /** Name variants the room can be found by. */
  aliases: string[];
  complexity: Complexity;
  /** Event types the room suits. */
  eventTypes: string[];
};

/** The room catalogue for points 1 and 1.1 (#25, #40). */
export interface Rooms {
  /** Every room, in any order. */
  list(): Promise<Room[]>;
}

/** One of the user's saved room groups (`saved_groups` with kind `room`, data model 4.2). */
export type RoomGroup = {
  id: string;
  name: string;
  /** Room codes in rank order: the first is the most preferred. */
  roomCodes: string[];
};

/** A taken name is an expected answer; any other failure rejects the promise. */
export type RoomGroupSave = { ok: true; group: RoomGroup } | { ok: false; reason: "name_taken" };

/** The user's room groups for point 1 (#25, #19). Names arrive trimmed, 1–100 characters; 1–200 rooms. */
export interface RoomGroups {
  /** The user's own room groups, in any order. */
  list(): Promise<RoomGroup[]>;
  /** Saves a new group, also "save under a new name". */
  create(name: string, roomCodes: string[]): Promise<RoomGroupSave>;
  /** Renames and reorders one of the user's groups; its id stays. */
  update(id: string, name: string, roomCodes: string[]): Promise<RoomGroupSave>;
}

/** How often an event type has been used (`event_type_popularity()`, data model 4.4). */
export type EventTypeUse = { eventType: string; useCount: number };

/** Event types for point 1.1, most used first (#25, #40). */
export interface EventTypes {
  popular(): Promise<EventTypeUse[]>;
}

/** A course of a curriculum (data model 5.2). */
export type Course = { code: string; name: string };

/** A curriculum as ASIO lists it (data model 5.2); chosen in #32. */
export type Curriculum = {
  /** The ASIO group code, such as "IFIFB-1" (UI-1, working assumption). */
  asioId?: string;
  university: string;
  building: string;
  institute: string;
  degreeLevel: string;
  programme: string;
  specialisation?: string;
  /** Absent or empty: the whole curriculum. */
  courses?: Course[];
};

/** Everything one search needs (`searches`, data model 4.3). */
export type SearchInput = {
  name: string | null;
  eventType: string;
  durationMinutes: number;
  attendees: number | null;
  /** Room codes in rank order: the first is the most preferred (`room_items`). */
  roomCodes: string[];
  /** The saved group the rooms were copied from (`source_room_group_id`). */
  roomGroupId: string | null;
  /** Only the weights that differ from the defaults; a missing class means the default (data model 5.3). */
  complexityWeights: Partial<Record<Complexity, number>>;
  timeWindows: TimeWindows;
};

/** The best time and room of a search. */
export type Best = { roomCode: string; start: UtcInstant; end: UtcInstant; score: number };

/** The answer of the matching (`searches.result`, data model 5.5). */
export type SearchResult = {
  /** Null when no time and room fit. */
  best: Best | null;
  /** The curricula, or one of their courses, whose classes overlap the best time. */
  unsuitableGroups: { curriculum: Curriculum; course?: Course; conflicts: Interval[] }[];
  warnings: "next_semester"[];
};

/** Where a search is (`searches.status`, `result` and `error`, data model 4.3). */
export type SearchStatus =
  | { status: "pending" | "running" }
  | { status: "done"; result: SearchResult }
  | { status: "failed"; error: string };

/** Running a search and reading its answer, for points 2 and 3 (#27, #23). */
export interface Searches {
  /** Saves the search and starts the matching; resolves with the search's id. */
  start(input: SearchInput): Promise<string>;
  /** The search's status now. Rejects for an id the user has no search with. */
  status(id: string): Promise<SearchStatus>;
}

export type Backend = {
  semester: Semester;
  rooms: Rooms;
  roomGroups: RoomGroups;
  eventTypes: EventTypes;
  searches: Searches;
};
