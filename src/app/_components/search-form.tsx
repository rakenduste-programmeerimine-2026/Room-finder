"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { changedWeights, DEFAULT_WEIGHTS } from "@/app/_lib/complexity";
import { EMPTY_EVENT, readAttendees, readEvent } from "@/app/_lib/event";
import { requiredChecks, summarise, type SummaryRow } from "@/app/_lib/search-summary";
import type { TimeWindows } from "@/app/_lib/time/time-windows";
import { useBackend } from "@/app/_ports/backend";
import type { Room, RoomGroup, SearchInput } from "@/app/_ports/ports";
import { ComplexityWeightsSection } from "./complexity-weights";
import { EventFields } from "./event-fields";
import { RoomGroupEditor } from "./room-group-editor";
import { RoomPicker, type RoomChoice } from "./room-picker";
import { SearchSummary } from "./search-summary";
import { TimeWindowTool } from "./time-window-tool";

const card = "flex flex-col gap-4 bg-layer p-6";
const sectionHeading = "text-xl font-normal focus:outline-none";

/** What the form hands over on "Leia aeg ja ruum": the search, its rooms and its summary. */
export type Submission = { input: SearchInput; rooms: Room[]; summary: SummaryRow[] };

/**
 * The new search and the room group editor. The form holds the inputs that depend on each
 * other (the duration limits the time ranges, the attendee count marks small rooms). While the
 * editor is open the form is only hidden, so every input stays (search journey, Composing).
 */
export function SearchForm({ onSubmit }: { onSubmit: (submission: Submission) => void }) {
  const backend = useBackend();
  const [event, setEvent] = useState(EMPTY_EVENT);
  const [catalog, setCatalog] = useState<Room[]>([]);
  const [groups, setGroups] = useState<RoomGroup[] | null | "failed">(null);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomChoice | null>(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [windows, setWindows] = useState<TimeWindows | null>(null);
  const [editing, setEditing] = useState<{ group: RoomGroup | null } | null>(null);
  const roomsHeading = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);

  useEffect(() => {
    let current = true;
    const failed = (what: string) => () => current && toast.error(`${what} ei õnnestunud laadida.`, { autoClose: false });
    backend.rooms.list().then((list) => current && setCatalog(list), failed("Ruumide nimekirja"));
    backend.roomGroups.list().then(
      (list) => current && setGroups(list),
      () => { if (current) { setGroups("failed"); failed("Ruumigruppe")(); } },
    );
    backend.eventTypes.popular().then(
      (list) => current && setEventTypes(list.map((t) => t.eventType)),
      failed("Ürituse tüüpe"),
    );
    return () => {
      current = false;
    };
  }, [backend]);

  // Back from the editor: put the focus where the user left the form.
  useEffect(() => {
    if (!editing && returning.current) {
      returning.current = false;
      roomsHeading.current?.focus();
    }
  }, [editing]);

  const attendees = readAttendees(event.attendees);
  const minimum = attendees === "invalid" ? null : attendees;
  const byCode = useMemo(() => new Map(catalog.map((room) => [room.code, room])), [catalog]);
  const read = readEvent(event);
  const roomCodes = rooms?.roomCodes ?? [];
  const roomGroup = (Array.isArray(groups) && groups.find((g) => g.id === rooms?.groupId)?.name) || null;
  const weightChanges = changedWeights(weights);
  const summary = summarise({
    event,
    roomGroup,
    roomCount: roomCodes.length,
    windows,
    weightsChanged: Object.keys(weightChanges).length > 0,
  });
  const submit = () => {
    if (!read.ok || !windows || roomCodes.length === 0) return;
    onSubmit({
      input: {
        ...read.event,
        roomCodes,
        roomGroupId: rooms?.groupId ?? null,
        complexityWeights: weightChanges,
        timeWindows: windows,
        curricula: null,
        curriculumGroupId: null,
      },
      rooms: roomCodes.flatMap((code) => byCode.get(code) ?? []),
      summary,
    });
  };
  const close = () => {
    returning.current = true;
    setEditing(null);
  };
  const saved = (group: RoomGroup) => {
    setGroups((list) => [...(Array.isArray(list) ? list : []).filter((g) => g.id !== group.id), group]);
    setRooms({ groupId: group.id, roomCodes: [...group.roomCodes] });
    close();
  };

  return (
    <>
      {/* Hidden, not unmounted: React's <Activity> froze the page in Chrome (docs/bugs). */}
      <div hidden={editing !== null} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="text-3xl font-normal focus:outline-none">Uus otsing</h1>
          <p className="text-sm text-ink-muted">Kõik ajad on Tallinna aja järgi.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <section aria-labelledby="uritus" className={card}>
              <h2 id="uritus" tabIndex={-1} className={sectionHeading}>Üritus</h2>
              <EventFields value={event} onChange={setEvent} eventTypes={eventTypes} />
            </section>

            <section aria-labelledby="ruumid" className={card}>
              <h2 id="ruumid" ref={roomsHeading} tabIndex={-1} className={sectionHeading}>Ruumid</h2>
              <RoomPicker groups={groups} catalog={catalog} value={rooms} onChange={setRooms} attendees={minimum}
                onEdit={(group) => setEditing({ group })} />
              <ComplexityWeightsSection value={weights} onChange={setWeights} />
            </section>

            <section aria-labelledby="kandidaatajad" className={card}>
              <div className="flex flex-col gap-1">
                <h2 id="kandidaatajad" tabIndex={-1} className={sectionHeading}>Kandidaatajad</h2>
                <p className="text-sm text-ink-muted">
                  Järjesta eelistuse järgi: üleval olev päev ja iga päeva esimene vahemik on kõige eelistatumad.
                </p>
              </div>
              <TimeWindowTool durationMinutes={event.durationMinutes} onChange={setWindows} />
            </section>
          </div>

          <SearchSummary rows={summary} checks={requiredChecks(read, roomCodes.length, windows)} onSubmit={submit} />
        </div>
      </div>

      {editing && (
        <RoomGroupEditor catalog={catalog} group={editing.group} groups={Array.isArray(groups) ? groups : []} attendees={minimum}
          onSaved={saved} onCancel={close} />
      )}
    </>
  );
}
