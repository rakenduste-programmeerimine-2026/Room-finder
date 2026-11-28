import { useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { BOOKING_HINTS } from "@/app/_lib/complexity";
import { curriculumName, rankOutcomes } from "@/app/_lib/curricula";
import { count, decimal } from "@/app/_lib/format";
import type { SummaryRow } from "@/app/_lib/search-summary";
import {
  formatTallinnDate,
  formatTallinnDay,
  formatTallinnTime,
  formatUtcTime,
  type UtcInstant,
} from "@/app/_lib/time/tallinn";
import type { AsioGroup, Best, Curriculum, Room, SearchInput, SearchResult } from "@/app/_ports/ports";
import { Calendar, Check, Pin, Warning } from "./icons";
import { RoomTags } from "./room-list";
import { InputSummary } from "./search-summary";
import { ghostButton, primaryButton, secondaryButton } from "./styles";

/** The search as it was sent, kept for the result: its inputs, its rooms and curricula, their summary and when it was sent. */
export type SentSearch = { input: SearchInput; rooms: Room[]; asioGroups: AsioGroup[]; summary: SummaryRow[]; at: UtcInstant };

const WARNINGS: Record<SearchResult["warnings"][number], string> = {
  next_semester:
    "Aeg on järgmisel poolaastal: õppekavade koostajatel on ruumide osas eelisjärjekord ja õppetöös kasutatava ruumi broneerimisel on oht ruum kaotada.",
};

const card = "flex flex-col gap-4 bg-layer p-6";
const tag = "rounded-full bg-subtle px-2 py-0.5 text-xs font-normal";
const times = (start: UtcInstant, end: UtcInstant) => `${formatTallinnTime(start)} – ${formatTallinnTime(end)}`;

function useFocusOnMount() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return heading;
}

export type SearchResultViewProps = {
  sent: SentSearch;
  best: Best;
  result: SearchResult;
  onEdit: () => void;
  onNew: () => void;
};

/** Frame 07: the best time and room, the groups it does not suit and the warnings (US-012). */
export function SearchResultView({ sent, best, result, onEdit, onNew }: SearchResultViewProps) {
  const heading = useFocusOnMount();
  const { input } = sent;
  const room = sent.rooms.find((r) => r.code === best.roomCode);
  const rank = input.roomCodes.indexOf(best.roomCode) + 1;
  const when = `${formatTallinnDay(best.start)}, ${times(best.start, best.end)}`;

  // Warnings are toasts (team rule point 0) and stay in the box below. The id is the time
  // section's, so one next-semester toast is shown at a time.
  useEffect(() => {
    if (result.warnings.includes("next_semester")) toast.warning(WARNINGS.next_semester, { toastId: "next-semester" });
  }, [result]);

  const copy = () =>
    navigator.clipboard
      .writeText(`${when} (Tallinna aja järgi), ruum ${[best.roomCode, ...(room?.aliases.slice(0, 1) ?? [])].join(" · ")}`)
      .then(
        () => toast.success("Aeg ja ruum kopeeritud."),
        () => toast.error("Kopeerimine ei õnnestunud. Vali tekst ja kopeeri see ise.", { autoClose: false }),
      );

  const subtitle = [
    input.name,
    input.eventType,
    input.attendees === null ? null : count(input.attendees, "inimene", "inimest"),
    `otsitud ${formatTallinnDate(sent.at)} ${formatTallinnTime(sent.at)}`,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-ink-muted">Tulemus</p>
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-normal focus:outline-none">Parim aeg ja ruum</h1>
        <p className="text-sm text-ink-muted">{subtitle.filter(Boolean).join(" · ")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Parim aeg ja ruum" className="flex flex-col gap-4 border border-interactive bg-highlight p-6">
            <span className="flex gap-2">
              <span className={tag}>Parim sobivus</span>
              <span className={tag}>Skoor {decimal(best.score)}</span>
            </span>
            <div className="flex gap-3">
              <span className="pt-1 text-interactive"><Calendar /></span>
              <div>
                <p className="font-semibold">{formatTallinnDay(best.start)}</p>
                <p className="text-4xl">{times(best.start, best.end)}</p>
                <p className="text-xs text-ink-muted">
                  Tallinna aja järgi · UTC {formatUtcTime(best.start)} – {formatUtcTime(best.end)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="pt-1 text-interactive"><Pin /></span>
              <div className="flex flex-col gap-1">
                <p className="text-xl">{[best.roomCode, ...(room?.aliases ?? [])].join(" · ")}</p>
                <span className="flex flex-wrap gap-1">
                  {room && <RoomTags room={room} attendees={input.attendees} />}
                  {rank > 0 && <span className={tag}>sinu {rank}. eelistus</span>}
                </span>
              </div>
            </div>
            {room && (
              <p className="bg-layer px-3 py-2 text-sm">
                Broneerimine: {BOOKING_HINTS[room.complexity]} Rakendus ise ruumi ei broneeri.
              </p>
            )}
            {/* PLACEHOLDER(#21): "Ava ruumi kalender ASIOs" waits for the ASIO link pattern (UI-6). */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={secondaryButton} onClick={copy}>Kopeeri aeg ja ruum</button>
              <span className="ml-auto flex gap-1">
                <button type="button" className={ghostButton} onClick={onEdit}>Muuda sisendeid</button>
                <button type="button" className={ghostButton} onClick={onNew}>Uus otsing</button>
              </span>
            </div>
          </section>

          <UnsuitableGroups chosen={input.curricula} groups={result.unsuitableGroups} catalog={sent.asioGroups} />
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="sisendid" className={card}>
            <h2 id="sisendid" className="text-lg font-semibold">Otsingu sisendid</h2>
            <InputSummary rows={sent.summary} />
            <button type="button" className={`${secondaryButton} w-full`} onClick={onEdit}>Muuda sisendeid</button>
          </section>
          <section aria-labelledby="hoiatused" className="flex flex-col gap-2 text-sm">
            <h2 id="hoiatused" className="font-semibold">Hoiatused</h2>
            {result.warnings.length === 0 ? (
              <p className="text-ink-muted">Hoiatusi pole.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {result.warnings.map((warning) => (
                  <li key={warning} className="flex gap-3 border-l-[3px] border-warning bg-warning-bg px-4 py-3">
                    <span className="text-warning-ink"><Warning /></span>
                    {WARNINGS[warning]}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type UnsuitableGroupsProps = {
  /** The search's curricula in rank order, null if it had none. */
  chosen: Curriculum[] | null;
  groups: SearchResult["unsuitableGroups"];
  catalog: AsioGroup[];
};

/**
 * "Kellele see aeg ei sobi" (point 3): the search's curricula in rank order, each with the class
 * times that overlap the best time, or marked as suiting it (frame 07, US-012).
 */
function UnsuitableGroups({ chosen, groups, catalog }: UnsuitableGroupsProps) {
  const names = useMemo(() => new Map(catalog.map((g) => [g.asioId, g])), [catalog]);
  const outcomes = rankOutcomes(chosen ?? [], groups);
  const clashing = outcomes.filter((o) => o.clashes.length > 0).length;
  return (
    <section aria-labelledby="ei-sobi" className={card}>
      <h2 className="flex items-center gap-2 text-xl font-normal">
        <span id="ei-sobi">Kellele see aeg ei sobi</span>
        {clashing > 0 && (
          <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs text-error-ink">
            {count(clashing, "grupp", "gruppi")}
          </span>
        )}
      </h2>
      {outcomes.length === 0 ? (
        <p className="text-sm">Õppekavu ei valitud, seega tundidega kattumist ei kontrollitud.</p>
      ) : (
        <>
          <p className="text-xs text-ink-muted">Sinu õppekavade eelisjärjestuses. Kõik ajad on Tallinna aja järgi.</p>
          <ul className="flex flex-col gap-2">
            {outcomes.map(({ rank, curriculum, clashes }) => {
              const title = `${rank ? `${rank}. ` : ""}${curriculumName(curriculum, names)}`;
              return clashes.length === 0 ? (
                <li key={curriculum.asioId} className="flex items-center gap-2 px-4 text-sm">
                  <span className="text-success"><Check /></span>
                  {`${title} (${curriculum.asioId}) – sobib`}
                </li>
              ) : (
                <li key={curriculum.asioId} className="flex gap-3 border border-subtle px-4 py-3">
                  <span className="text-error-ink"><Warning /></span>
                  <div className="flex flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {title}
                      <span className={tag}>{curriculum.asioId}</span>
                    </p>
                    {clashes.map((clash, i) => (
                      <p key={i} className="text-xs text-ink-muted">
                        Kattub: {clash.conflicts.map((c) => times(c.start, c.end)).join(", ")}
                        {clash.course ? ` · ${clash.course.name}` : ""}
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

const SUGGESTIONS = [
  "Lisa päevi või laienda ajavahemikke",
  "Lisa gruppi ruume või vali teine ruumigrupp",
  "Tõsta raskemini saadavate ruumide kaalu (nt ülikooli luba)",
  "Vähenda osalejate arvu või ürituse kestust",
];

/** Frame 08 D: the search finished, but no time and room fit (US-013). */
export function NoResultView({ onEdit, onNew }: { onEdit: () => void; onNew: () => void }) {
  const heading = useFocusOnMount();
  return (
    <section aria-labelledby="ei-leitud" className="flex max-w-3xl flex-col gap-4 bg-layer px-8 py-7">
      <h1 id="ei-leitud" ref={heading} tabIndex={-1} className="text-2xl font-normal focus:outline-none">
        Sobivat aega ja ruumi ei leitud
      </h1>
      <p className="text-sm">Kõik valitud ruumid olid valitud aegadel hõivatud või liiga väikesed. Proovi üht järgmistest:</p>
      <ul className="list-disc pl-5 text-sm">
        {SUGGESTIONS.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
      </ul>
      <div className="flex gap-2">
        <button type="button" className={primaryButton} onClick={onEdit}>Muuda sisendeid</button>
        <button type="button" className={secondaryButton} onClick={onNew}>Uus otsing</button>
      </div>
    </section>
  );
}
