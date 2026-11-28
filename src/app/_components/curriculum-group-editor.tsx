import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  curriculumName,
  curriculumOf,
  curriculumPath,
  distinct,
  searchCurricula,
  shortName,
  withCourses,
  type CurriculumFilter,
} from "@/app/_lib/curricula";
import { count } from "@/app/_lib/format";
import { move } from "@/app/_lib/move";
import { checkGroup, MAX_GROUP_ITEMS, MAX_GROUP_NAME_LENGTH, type GroupIssue } from "@/app/_lib/saved-group";
import { useBackend } from "@/app/_ports/backend";
import type { AsioGroup, Curriculum, CurriculumGroup } from "@/app/_ports/ports";
import { saveGroup } from "./group-save";
import { RankedList } from "./ranked-list";
import { Select } from "./select";
import { error, field, ghostButton, helper, label, primaryButton, secondaryButton } from "./styles";

export type CurriculumGroupEditorProps = {
  catalog: AsioGroup[];
  /** The group to change, or null for a new one. */
  group: CurriculumGroup | null;
  /** All of the user's curriculum groups, to keep names unique. */
  groups: CurriculumGroup[];
  onSaved: (group: CurriculumGroup) => void;
  onCancel: () => void;
};

const MESSAGES: Record<GroupIssue, string> = {
  missing_name: "Anna grupile nimi.",
  name_too_long: `Nimi võib olla kuni ${MAX_GROUP_NAME_LENGTH} märki.`,
  name_taken: "Sul on juba sellise nimega õppekavade grupp.",
  empty: "Vali gruppi vähemalt üks õppekava.",
  too_many: `Grupis saab olla kuni ${MAX_GROUP_ITEMS} õppekava.`,
};

const PLACES = [
  ["university", "Ülikool"],
  ["building", "Maja"],
  ["institute", "Instituut"],
] as const;

const tag = "rounded-full bg-subtle px-2 py-0.5 text-xs font-normal";

/**
 * Point 1.3: choose curricula by study year as the ASIO page lists them, optionally only some of
 * their courses, rank them and save the group (frame 05, US-009).
 */
export function CurriculumGroupEditor({ catalog, group, groups, onSaved, onCancel }: CurriculumGroupEditorProps) {
  const backend = useBackend();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [filter, setFilter] = useState<CurriculumFilter>({
    degreeLevel: "",
    university: "",
    building: "",
    institute: "",
    query: "",
  });
  const [name, setName] = useState(group?.name ?? "");
  const [chosen, setChosen] = useState<Curriculum[]>(group?.curricula ?? []);
  const [choosingCourses, setChoosingCourses] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => heading.current?.focus(), []);

  const byId = useMemo(() => new Map(catalog.map((g) => [g.asioId, g])), [catalog]);
  const levels = useMemo(() => distinct(catalog.map((g) => g.degreeLevel)), [catalog]);
  const level = levels.includes(filter.degreeLevel) ? filter.degreeLevel : (levels[0] ?? "");
  const inLevel = catalog.filter((g) => g.degreeLevel === level);
  const blocks = useMemo(() => searchCurricula(catalog, { ...filter, degreeLevel: level }), [catalog, filter, level]);
  const otherNames = (asNew: boolean) => groups.filter((g) => asNew || g.id !== group?.id).map((g) => g.name);
  const issues = checkGroup(name, chosen.length, otherNames(group === null)).issues;
  // An empty name or group is only an error once the user tries to save.
  const shown = issues.filter((i) => attempted || (i !== "missing_name" && i !== "empty"));
  const nameIssue = shown.find((i) => i !== "empty" && i !== "too_many");
  const listIssue = shown.find((i) => i === "empty" || i === "too_many");
  const full = chosen.length >= MAX_GROUP_ITEMS;
  const tabId = (index: number) => `${id}-tab-${index}`;

  // The place filters list the open tab's values, so a new tab starts without them.
  const selectLevel = (degreeLevel: string) =>
    setFilter({ ...filter, degreeLevel, university: "", building: "", institute: "" });
  const choose = (asioGroup: AsioGroup, on: boolean) =>
    setChosen(on ? [...chosen, curriculumOf(asioGroup)] : chosen.filter((c) => c.asioId !== asioGroup.asioId));

  function onTabKey(e: KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (index + step + levels.length) % levels.length;
    selectLevel(levels[next]);
    document.getElementById(tabId(next))?.focus();
  }

  async function save(asNew: boolean) {
    setAttempted(true);
    setSaving(true);
    const saved = await saveGroup(backend.curriculumGroups, {
      id: asNew || !group ? null : group.id,
      name,
      items: chosen,
      otherNames: otherNames(asNew),
      messages: MESSAGES,
    });
    setSaving(false);
    if (saved) onSaved(saved);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">Uus otsing · Õppekavad ja ained</p>
        <h1 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-3xl font-normal focus:outline-none">
          {group ? `Õppekavade grupp: ${group.name}` : "Uus õppekavade grupp"}
        </h1>
        <p className="text-sm text-ink-muted">
          Sama sisu ja struktuur nagu ASIO lehel „Õppetöö ja üritused“, uues vaates. Vali õppekavad ja soovi korral
          ained, järjesta need ja salvesta grupp.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby={`${id}-find`} className="flex flex-col gap-4 bg-layer p-6">
          <h2 id={`${id}-find`} className="text-xl font-normal">Vali õppekavad</h2>
          <div role="tablist" aria-label="Õppetase" className="flex flex-wrap border-b border-subtle">
            {levels.map((l, i) => (
              <button key={l} id={tabId(i)} type="button" role="tab" aria-selected={l === level}
                aria-controls={`${id}-panel`} tabIndex={l === level ? 0 : -1}
                className={`-mb-px border-b-2 px-4 py-2 text-sm ${l === level ? "border-interactive font-semibold" : "border-transparent text-ink-muted hover:bg-subtle"}`}
                onClick={() => selectLevel(l)} onKeyDown={(e) => onTabKey(e, i)}>
                {l}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`${id}-panel`} aria-labelledby={tabId(levels.indexOf(level))}
            className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {PLACES.map(([key, text]) => (
                <div key={key} className="flex flex-col gap-2">
                  <label htmlFor={`${id}-${key}`} className={label}>{text}</label>
                  <Select id={`${id}-${key}`} value={filter[key]} onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}>
                    <option value="">Kõik</option>
                    {distinct(inLevel.map((g) => g[key])).map((value) => <option key={value} value={value}>{value}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-query`} className={label}>Otsi eriala, suuna või koodi järgi</label>
              <input id={`${id}-query`} type="search" autoComplete="off" value={filter.query} className={field}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
            </div>

            <p role="status" className={helper}>
              {catalog.length === 0
                ? "Õppekavade nimekiri on tühi: see laadib veel või ei õnnestunud laadida."
                : `Leitud õppekavu: ${blocks.length}`}
            </p>
            <ul aria-label="Leitud õppekavad" className="flex flex-col gap-2">
              {blocks.map((block) => (
                <li key={block.programmeCode}>
                  <fieldset className="flex flex-col gap-2 border border-subtle px-4 py-3">
                    <legend className="contents">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {block.title}
                        <span className={tag}>{block.programmeCode}</span>
                      </span>
                    </legend>
                    <span className="text-xs text-ink-muted">{block.path}</span>
                    <span className="flex flex-wrap gap-x-5 gap-y-1">
                      {block.groups.map((g) => {
                        const on = chosen.some((c) => c.asioId === g.asioId);
                        return (
                          <label key={g.asioId} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="size-4 accent-interactive" checked={on}
                              disabled={!on && full} aria-label={g.name} onChange={(e) => choose(g, e.target.checked)} />
                            {shortName(g, block.title)}
                          </label>
                        );
                      })}
                    </span>
                  </fieldset>
                </li>
              ))}
            </ul>
            {/* PLACEHOLDER(#30): the list is made-up example data until the backend reads it from ASIO. */}
            <p className={helper}>Näidisandmed: päris nimekiri tuleb ASIOst (#30).</p>
          </div>
        </section>

        <section aria-labelledby={`${id}-group`} className="flex flex-col gap-4 bg-layer p-6">
          <h2 id={`${id}-group`} className="text-xl font-normal">Grupp</h2>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className={label}>Grupi nimi</label>
            <input id={`${id}-name`} type="text" autoComplete="off" value={name} className={field}
              aria-required="true" aria-invalid={nameIssue !== undefined} aria-describedby={`${id}-name-message`}
              onChange={(e) => setName(e.target.value)} />
            <p id={`${id}-name-message`} className={nameIssue ? error : helper}>
              {nameIssue
                ? MESSAGES[nameIssue]
                : group
                  ? "Salvesta uue nimega, et lähtegrupp jääks alles, või kirjuta lähtegrupp üle."
                  : `Nimi on sinu õppekavade gruppide seas unikaalne (1–${MAX_GROUP_NAME_LENGTH} märki).`}
            </p>
          </div>

          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Eelisjärjestus</h3>
            <span className="text-xs text-ink-muted">{count(chosen.length, "õppekava", "õppekava")} · max {MAX_GROUP_ITEMS}</span>
          </div>
          <p className={listIssue ? error : helper}>
            {listIssue ? MESSAGES[listIssue] : "1. õppekava tunnid on kõige olulisem vältida. Lohista ridu või kasuta nooli."}
          </p>
          <RankedList label="Grupi õppekavad" items={chosen} nameOf={(c) => c.asioId}
            onMove={(from, to) => setChosen(move(chosen, from, to))}
            onRemove={(index) => setChosen(chosen.filter((_, i) => i !== index))}>
            {(c) => {
              const asioGroup = byId.get(c.asioId);
              const open = choosingCourses === c.asioId;
              return (
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{curriculumName(c, byId)}</span>
                    <span className={tag}>{c.asioId}</span>
                  </span>
                  <span className="text-xs text-ink-muted">{curriculumPath(c)}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs">
                    Ained:
                    {c.courses?.length
                      ? c.courses.map((course) => <span key={course.code} className={tag}>{course.name}</span>)
                      : <span className={tag}>kõik ained</span>}
                    {asioGroup && asioGroup.courses.length > 0 && (
                      <button type="button" className={`${ghostButton} ml-auto`} aria-expanded={open}
                        aria-label={`${c.asioId}: ${open ? "ained valitud" : "vali aineid"}`}
                        onClick={() => setChoosingCourses(open ? null : c.asioId)}>
                        {open ? "Valmis" : "Vali aineid"}
                      </button>
                    )}
                  </span>
                  {open && asioGroup && (
                    <fieldset className="flex flex-col gap-1 pt-1">
                      <legend className="sr-only">{`Ained: ${asioGroup.name}`}</legend>
                      {asioGroup.courses.map((course) => (
                        <label key={course.code} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="size-4 accent-interactive"
                            checked={c.courses?.some((x) => x.code === course.code) ?? false}
                            onChange={(e) => {
                              const picked = new Set((c.courses ?? []).map((x) => x.code));
                              if (e.target.checked) picked.add(course.code);
                              else picked.delete(course.code);
                              const courses = asioGroup.courses.filter((x) => picked.has(x.code));
                              setChosen(chosen.map((x) => (x.asioId === c.asioId ? withCourses(x, courses) : x)));
                            }} />
                          {course.code} {course.name}
                        </label>
                      ))}
                      <p className={helper}>Kui ühtegi ainet pole valitud, arvestatakse kogu õppekava tunniplaani.</p>
                    </fieldset>
                  )}
                </span>
              );
            }}
          </RankedList>

          <div className="flex flex-wrap gap-2 pt-2">
            {group ? (
              <>
                <button type="button" className={primaryButton} disabled={saving} onClick={() => save(true)}>
                  Salvesta uue nimega
                </button>
                <button type="button" className={secondaryButton} disabled={saving} onClick={() => save(false)}>
                  Kirjuta lähtegrupp üle
                </button>
              </>
            ) : (
              <button type="button" className={primaryButton} disabled={saving} onClick={() => save(true)}>
                Salvesta grupp
              </button>
            )}
            <button type="button" className={`${ghostButton} ml-auto h-10`} disabled={saving} onClick={onCancel}>
              Tühista
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
