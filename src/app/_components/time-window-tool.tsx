"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { formatDuration } from "@/app/_lib/format";
import { move } from "@/app/_lib/move";
import {
  formatLocalDate,
  formatTallinnDate,
  parseLocalDate,
  type LocalDate,
  type LocalTime,
  type UtcInstant,
} from "@/app/_lib/time/tallinn";
import {
  buildTimeWindows,
  datesInNextSemester,
  MAX_DAYS,
  MAX_RANGES_PER_DAY,
  readEnd,
  type DraftDay,
  type DraftIssue,
  type TimeWindows,
} from "@/app/_lib/time/time-windows";
import { useBackend } from "@/app/_ports/backend";
import { field, ghostButton, iconButton } from "./styles";
import { ChevronDown, ChevronUp, Clock, Close, Warning } from "./icons";

type RangeRow = { id: number; start: LocalTime; end: LocalTime };
type DayRow = { id: number; date: LocalDate; ranges: RangeRow[] };

export type TimeWindowToolProps = {
  /** The event length in minutes; every range must fit it. */
  durationMinutes: number;
  /** Receives the built time windows, or null while the input has problems. */
  onChange?: (windows: TimeWindows | null) => void;
};

const DEFAULT_RANGE = { start: "10:00", end: "12:00" };

const toDraft = (days: DayRow[]): DraftDay[] =>
  days.map((day) => ({
    date: day.date,
    ranges: day.ranges.map((range) => ({ start: range.start, end: readEnd(range.start, range.end) })),
  }));

function message(issue: DraftIssue, durationMinutes: number): string {
  switch (issue.code) {
    case "invalid_date": return "Sellist kuupäeva pole.";
    case "duplicate_date": return "See päev on juba lisatud.";
    case "no_ranges": return "Lisa vähemalt üks vahemik.";
    case "too_many_ranges": return `Päevas saab olla kuni ${MAX_RANGES_PER_DAY} vahemikku.`;
    case "invalid_time": return "Sisesta algus ja lõpp.";
    case "nonexistent_time": return "Seda kellaaega sel päeval ei ole (kellakeeramine).";
    case "end_not_after_start": return "Lõpp peab olema pärast algust.";
    case "shorter_than_duration": return `Vahemik on lühem kui ürituse kestus (${formatDuration(durationMinutes)}).`;
    case "no_days": return "Lisa vähemalt üks päev.";
    case "too_many_days": return `Päevi saab olla kuni ${MAX_DAYS}.`;
    case "too_large": return "Aegu on liiga palju. Eemalda mõni päev või vahemik.";
    case "invalid_duration": return "Ürituse kestus peab olema 5 minutit kuni 24 tundi.";
  }
}

/** Point 1.2: candidate days and time ranges, ranked by preference (#26). */
export function TimeWindowTool({ durationMinutes, onChange }: TimeWindowToolProps) {
  const backend = useBackend();
  const baseId = useId();
  const nextId = useRef(2);
  const [days, setDays] = useState<DayRow[]>([{ id: 0, date: "", ranges: [{ id: 1, ...DEFAULT_RANGE }] }]);
  const [semesterStart, setSemesterStart] = useState<UtcInstant | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const warned = useRef<LocalDate[]>([]);

  const draft = useMemo(() => toDraft(days), [days]);
  const built = useMemo(() => buildTimeWindows(draft, durationMinutes), [draft, durationMinutes]);
  const issues = built.ok ? [] : built.issues;

  const affected = useMemo(
    () => (semesterStart ? datesInNextSemester(draft.filter((d) => parseLocalDate(d.date)), semesterStart) : []),
    [draft, semesterStart],
  );

  useEffect(() => {
    onChange?.(built.ok ? built.windows : null);
  }, [built, onChange]);

  useEffect(() => {
    let current = true;
    backend.semester.nextStart().then(
      (start) => current && setSemesterStart(start),
      () => current && toast.error("Järgmise poolaasta algust ei õnnestunud laadida.", { autoClose: false }),
    );
    return () => {
      current = false;
    };
  }, [backend]);

  useEffect(() => {
    const grew = affected.some((date) => !warned.current.includes(date));
    warned.current = affected;
    if (grew) {
      toast.warning(
        "Järgmine poolaasta: õppekavade koostajatel on ruumide osas eelisjärjekord ja õppetöös kasutatava ruumi broneerimisel on oht ruum kaotada.",
        {
        toastId: "next-semester",
        },
      );
    }
  }, [affected]);

  const newId = () => nextId.current++;
  const update = (next: DayRow[], note = "") => {
    setDays(next);
    // The count changes the text even when the same note repeats, so it is announced again.
    if (note) setAnnouncement((a) => ({ text: note, count: a.count + 1 }));
  };
  const setDay = (index: number, change: Partial<DayRow>) =>
    update(days.map((day, i) => (i === index ? { ...day, ...change } : day)));
  const setRanges = (index: number, ranges: RangeRow[], note = "") =>
    update(days.map((day, i) => (i === index ? { ...day, ranges } : day)), note);

  const dayIssues = (day: number) => issues.filter((i) => "day" in i && i.day === day && !("range" in i));
  const rangeIssue = (day: number, range: number) =>
    issues.find((i) => "range" in i && i.day === day && i.range === range);
  const formIssues = issues.filter((i) => !("day" in i));

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Clock />
        Ajad on Tallinna aja järgi. Rakendus salvestab ja saadab need UTC-s. Lõpuaeg 00:00 tähendab päeva lõppu
        (00:00–00:00 pole lubatud).
      </p>

      {affected.length > 0 && semesterStart && (
        <div role="status" className="flex gap-3 border-l-[3px] border-warning bg-warning-bg px-4 py-3 text-sm">
          <span className="text-warning-ink"><Warning /></span>
          <div>
            <p className="font-semibold">Valitud päevad on järgmisel poolaastal</p>
            <p>
              Õppekavade koostajatel on ruumide osas eelisjärjekord. Kui broneerid õppetöös kasutatava ruumi, on oht
              ruum kaotada. Poolaasta algus: {formatTallinnDate(semesterStart)}.
            </p>
          </div>
        </div>
      )}

      <ol aria-label="Kandidaatpäevad" className="flex flex-col gap-3">
        {days.map((day, d) => {
          const valid = parseLocalDate(day.date) !== null;
          const label = `Päev ${d + 1}`;
          const messageId = `${baseId}-day-${day.id}`;
          const problems = dayIssues(d).filter((i) => !(i.code === "invalid_date" && day.date === ""));
          return (
            <li key={day.id} className="flex flex-col gap-3 bg-page p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 font-semibold text-ink-muted">{d + 1}.</span>
                <input
                  type="date"
                  aria-label={`${label}: kuupäev`}
                  value={day.date}
                  onChange={(e) => setDay(d, { date: e.target.value })}
                  aria-invalid={problems.length > 0}
                  aria-describedby={messageId}
                  className={field}
                />
                {valid && <span className="font-semibold">{formatLocalDate(day.date)}</span>}
                <span className="ml-auto flex items-center">
                  <button type="button" className={iconButton} aria-label={`${label}: liiguta üles`} disabled={d === 0}
                    onClick={() => update(move(days, d, d - 1), `${label} on nüüd ${d}. kohal.`)}>
                    <ChevronUp />
                  </button>
                  <button type="button" className={iconButton} aria-label={`${label}: liiguta alla`} disabled={d === days.length - 1}
                    onClick={() => update(move(days, d, d + 1), `${label} on nüüd ${d + 2}. kohal.`)}>
                    <ChevronDown />
                  </button>
                  <button type="button" className={ghostButton} disabled={days.length === 1} aria-label={`${label}: eemalda`}
                    onClick={() => update(days.filter((_, i) => i !== d), `${label} eemaldati.`)}>
                    Eemalda päev
                  </button>
                </span>
              </div>
              <p id={messageId} className={problems.length ? "text-xs text-error-ink" : "text-xs text-helper"}>
                {problems.length ? problems.map((i) => message(i, durationMinutes)).join(" ") : day.date ? "" : "Vali kuupäev."}
              </p>

              <ol aria-label={`${label}: vahemikud`} className="flex flex-col gap-2">
                {day.ranges.map((range, r) => {
                  const rangeLabel = `${label}, vahemik ${r + 1}`;
                  const issue = rangeIssue(d, r);
                  const rangeMessageId = `${baseId}-range-${range.id}`;
                  return (
                    <li key={range.id} className="flex flex-wrap items-center gap-2">
                      <span className="w-6 text-xs font-semibold text-ink-muted">{r + 1}.</span>
                      <input type="time" aria-label={`${rangeLabel}: algus`} value={range.start} className={field}
                        aria-invalid={issue !== undefined} aria-describedby={rangeMessageId}
                        onChange={(e) => setRanges(d, day.ranges.map((x, i) => (i === r ? { ...x, start: e.target.value } : x)))} />
                      <span aria-hidden="true">–</span>
                      <input type="time" aria-label={`${rangeLabel}: lõpp`} value={range.end} className={field}
                        aria-invalid={issue !== undefined} aria-describedby={rangeMessageId}
                        onChange={(e) => setRanges(d, day.ranges.map((x, i) => (i === r ? { ...x, end: e.target.value } : x)))} />
                      <button type="button" className={iconButton} aria-label={`${rangeLabel}: liiguta üles`} disabled={r === 0}
                        onClick={() => setRanges(d, move(day.ranges, r, r - 1), `${rangeLabel} on nüüd ${r}. kohal.`)}>
                        <ChevronUp />
                      </button>
                      <button type="button" className={iconButton} aria-label={`${rangeLabel}: liiguta alla`} disabled={r === day.ranges.length - 1}
                        onClick={() => setRanges(d, move(day.ranges, r, r + 1), `${rangeLabel} on nüüd ${r + 2}. kohal.`)}>
                        <ChevronDown />
                      </button>
                      <button type="button" className={iconButton} aria-label={`${rangeLabel}: eemalda`} disabled={day.ranges.length === 1}
                        onClick={() => setRanges(d, day.ranges.filter((_, i) => i !== r), `${rangeLabel} eemaldati.`)}>
                        <Close />
                      </button>
                      <p id={rangeMessageId} className="basis-full pl-8 text-xs text-error-ink">
                        {issue ? message(issue, durationMinutes) : ""}
                      </p>
                    </li>
                  );
                })}
              </ol>

              <button type="button" className={`${ghostButton} self-start`} disabled={day.ranges.length >= MAX_RANGES_PER_DAY}
                aria-label={`${label}: lisa vahemik`}
                onClick={() => setRanges(d, [...day.ranges, { id: newId(), ...DEFAULT_RANGE }], `${label}: vahemik lisati.`)}>
                + Lisa vahemik
              </button>
            </li>
          );
        })}
      </ol>

      {formIssues.length > 0 && (
        <p className="text-sm text-error-ink">{formIssues.map((i) => message(i, durationMinutes)).join(" ")}</p>
      )}

      <button type="button" disabled={days.length >= MAX_DAYS}
        className="h-12 self-start bg-secondary pr-12 pl-4 text-left text-sm text-white hover:bg-secondary-hover disabled:bg-disabled"
        onClick={() => update([...days, { id: newId(), date: "", ranges: [{ id: newId(), ...DEFAULT_RANGE }] }], "Päev lisati.")}>
        + Lisa päev
      </button>

      <p aria-live="polite" className="sr-only">
        {announcement.text}
        {announcement.count % 2 ? " " : ""}
      </p>
    </div>
  );
}
