"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { changedWeights, DEFAULT_WEIGHTS } from "@/app/_lib/complexity";
import { EMPTY_EVENT, readAttendees, readEvent } from "@/app/_lib/event";
import { requiredChecks, summarise, type SummaryRow } from "@/app/_lib/search-summary";
import type { TimeWindows } from "@/app/_lib/time/time-windows";
import { useBackend } from "@/app/_ports/backend";
import type { AsioGroup, CurriculumGroup, Room, RoomGroup, SearchInput } from "@/app/_ports/ports";
import { ComplexityWeightsSection } from "./complexity-weights";
import { CurriculumGroupEditor } from "./curriculum-group-editor";
import { CurriculumPicker, type CurriculumChoice } from "./curriculum-picker";
import { EventFields } from "./event-fields";
import { RoomGroupEditor } from "./room-group-editor";
import { RoomPicker, type RoomChoice } from "./room-picker";
import { SearchSummary } from "./search-summary";
import { TimeWindowTool } from "./time-window-tool";

const card = "flex flex-col gap-4 bg-layer p-6";
const sectionHeading = "text-xl font-normal focus:outline-none";

/** What the form hands over on "Leia aeg ja ruum": the search, its rooms and curricula from the catalogues, and its summary. */
export type Submission = { input: SearchInput; rooms: Room[]; asioGroups: AsioGroup[]; summary: SummaryRow[] };

type Editing =
  | { kind: "rooms"; group: RoomGroup | null }
  | { kind: "curricula"; group: CurriculumGroup | null };

/** Adds a saved group to the list, or replaces the one with its id. */
const withSaved = <G extends { id: string }>(list: G[] | null | "failed", group: G): G[] =>
  [...(Array.isArray(list) ? list : []).filter((g) => g.id !== group.id), group];

/**
 * The new search and the group editors. The form holds the inputs that depend on each other
 * (the duration limits the time ranges, the attendee count marks small rooms). While an editor
 * is open the form is only hidden, so every input stays (search journey, Composing).
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
  const [asioGroups, setAsioGroups] = useState<AsioGroup[]>([]);
  const [curriculumGroups, setCurriculumGroups] = useState<CurriculumGroup[] | null | "failed">(null);
  const [curricula, setCurricula] = useState<CurriculumChoice | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const roomsHeading = useRef<HTMLHeadingElement>(null);
  const curriculaHeading = useRef<HTMLHeadingElement>(null);
  const returning = useRef<Editing["kind"] | null>(null);

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
    backend.curricula.list().then((list) => current && setAsioGroups(list), failed("Õppekavade nimekirja"));
    backend.curriculumGroups.list().then(
      (list) => current && setCurriculumGroups(list),
      () => { if (current) { setCurriculumGroups("failed"); failed("Õppekavade gruppe")(); } },
    );
    return () => {
      current = false;
    };
  }, [backend]);

  // Back from an editor: put the focus where the user left the form.
  useEffect(() => {
    if (!editing && returning.current) {
      (returning.current === "rooms" ? roomsHeading : curriculaHeading).current?.focus();
      returning.current = null;
    }
  }, [editing]);

  const attendees = readAttendees(event.attendees);
  const minimum = attendees === "invalid" ? null : attendees;
  const byCode = useMemo(() => new Map(catalog.map((room) => [room.code, room])), [catalog]);
  const byAsioId = useMemo(() => new Map(asioGroups.map((g) => [g.asioId, g])), [asioGroups]);
  const read = readEvent(event);
  const roomCodes = rooms?.roomCodes ?? [];
  const chosenCurricula = curricula?.curricula ?? [];
  const nameOf = (list: { id: string; name: string }[] | null | "failed", id?: string) =>
    (Array.isArray(list) && list.find((g) => g.id === id)?.name) || null;
  const weightChanges = changedWeights(weights);
  const summary = summarise({
    event,
    roomGroup: nameOf(groups, rooms?.groupId),
    roomCount: roomCodes.length,
    windows,
    curriculumGroup: nameOf(curriculumGroups, curricula?.groupId),
    curriculumCount: chosenCurricula.length,
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
        csvFilename: null,
        curricula: chosenCurricula.length ? chosenCurricula : null,
        curriculumGroupId: chosenCurricula.length ? (curricula?.groupId ?? null) : null,
      },
      rooms: roomCodes.flatMap((code) => byCode.get(code) ?? []),
      asioGroups: chosenCurricula.flatMap((c) => byAsioId.get(c.asioId) ?? []),
      summary,
    });
  };
  const close = () => {
    returning.current = editing?.kind ?? null;
    setEditing(null);
  };
  const savedRooms = (group: RoomGroup) => {
    setGroups((list) => withSaved(list, group));
    setRooms({ groupId: group.id, roomCodes: [...group.roomCodes] });
    close();
  };
  const savedCurricula = (group: CurriculumGroup) => {
    setCurriculumGroups((list) => withSaved(list, group));
    setCurricula({ groupId: group.id, curricula: structuredClone(group.curricula) });
    close();
  };

  return (
    <>
      {/* Hidden, not unmounted: React's <Activity> froze the page in Chrome (docs/bugs). */}
      <div hidden={editing !== null} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="text-3xl font-normal focus:outline-none">Uus otsing</h1>
          <p className="text-sm text-ink-muted">
            Üritus, ruumid ja kandidaatajad on kohustuslikud, õppekavad valikulised. Kõik ajad on Tallinna aja järgi.
          </p>
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
                onEdit={(group) => setEditing({ kind: "rooms", group })} />
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

            <section aria-labelledby="oppekavad" className={card}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 id="oppekavad" ref={curriculaHeading} tabIndex={-1} className={sectionHeading}>Õppekavad ja ained</h2>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-xs">Valikuline</span>
                </div>
                <p className="text-sm text-ink-muted">
                  Vali õppekavad, mille tundidega üritus ei tohiks kattuda. Sobimatud grupid näed tulemuses.
                </p>
              </div>
              <CurriculumPicker groups={curriculumGroups} catalog={byAsioId} value={curricula} onChange={setCurricula}
                onEdit={(group) => setEditing({ kind: "curricula", group })} />
            </section>
          </div>

          <SearchSummary rows={summary} checks={requiredChecks(read, roomCodes.length, windows)} onSubmit={submit} />
        </div>
      </div>

      {editing?.kind === "rooms" && (
        <RoomGroupEditor catalog={catalog} group={editing.group} groups={Array.isArray(groups) ? groups : []}
          attendees={minimum} onSaved={savedRooms} onCancel={close} />
      )}
      {editing?.kind === "curricula" && (
        <CurriculumGroupEditor catalog={asioGroups} group={editing.group}
          groups={Array.isArray(curriculumGroups) ? curriculumGroups : []} onSaved={savedCurricula} onCancel={close} />
      )}
    </>
  );
}
