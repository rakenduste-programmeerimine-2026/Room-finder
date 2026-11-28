import type { AsioGroup, Course, Curriculum, SearchResult } from "@/app/_ports/ports";
import { fold } from "./text";

/** What the curriculum list shows: one degree level, optional place filters ("" = all) and a search text. */
export type CurriculumFilter = {
  degreeLevel: string;
  university: string;
  building: string;
  institute: string;
  query: string;
};

/** One curriculum as the ASIO page lists it: its title, where it is taught and its groups by study year. */
export type CurriculumBlock = { programmeCode: string; title: string; path: string; groups: AsioGroup[] };

const collator = new Intl.Collator("et", { numeric: true });

/** The different values, in the order they first appear. */
export const distinct = (values: readonly string[]): string[] => [...new Set(values)];

/** Where a curriculum is taught: "TLÜ › Peahoone › DTI › Bakalaureuseõpe". */
export const curriculumPath = (c: Pick<Curriculum, "university" | "building" | "institute" | "degreeLevel">): string =>
  [c.university, c.building, c.institute, c.degreeLevel].join(" › ");

/** A curriculum's programme with its specialisation: "Informaatika (Tarkvaraarendus)". */
export const programmeTitle = (c: Pick<Curriculum, "programme" | "specialisation">): string =>
  c.specialisation ? `${c.programme} (${c.specialisation})` : c.programme;

/**
 * The groups of one degree level that pass the filters, as blocks per curriculum: the search text
 * is looked for in the group's name, programme, specialisation and codes. Blocks are sorted by
 * title, groups by code, numbers in numeric order.
 */
export function searchCurricula(catalog: readonly AsioGroup[], filter: CurriculumFilter): CurriculumBlock[] {
  const query = fold(filter.query);
  const blocks = new Map<string, CurriculumBlock>();
  for (const group of catalog) {
    const shown =
      group.degreeLevel === filter.degreeLevel &&
      (!filter.university || group.university === filter.university) &&
      (!filter.building || group.building === filter.building) &&
      (!filter.institute || group.institute === filter.institute) &&
      (!query ||
        [group.name, group.programme, group.specialisation ?? "", group.asioId, group.programmeCode].some((text) =>
          fold(text).includes(query),
        ));
    if (!shown) continue;
    const block = blocks.get(group.programmeCode) ??
      { programmeCode: group.programmeCode, title: programmeTitle(group), path: curriculumPath(group), groups: [] };
    block.groups.push(group);
    blocks.set(group.programmeCode, block);
  }
  return [...blocks.values()]
    .sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.programmeCode, b.programmeCode))
    .map((block) => ({ ...block, groups: block.groups.sort((a, b) => collator.compare(a.asioId, b.asioId)) }));
}

/** A group's name inside its curriculum's block: "Informaatika 1. õ.-a." → "1. õ.-a."; the whole name if nothing is left. */
export function shortName(group: AsioGroup, title: string): string {
  const rest = group.name.startsWith(title) ? group.name.slice(title.length).replace(/^[\s,]+/, "") : "";
  return rest || group.name;
}

/** A chosen curriculum with these courses; none means the whole curriculum, so `courses` is left out. */
export function withCourses(curriculum: Curriculum, courses: readonly Course[]): Curriculum {
  const next: Curriculum = { ...curriculum };
  delete next.courses;
  return courses.length ? { ...next, courses: [...courses] } : next;
}

/** What a search and a saved group keep of a catalogue group (data model 5.2): the whole curriculum at first. */
export function curriculumOf(group: AsioGroup): Curriculum {
  const { asioId, university, building, institute, degreeLevel, programme, specialisation } = group;
  return {
    asioId,
    university,
    building,
    institute,
    degreeLevel,
    programme,
    ...(specialisation ? { specialisation } : {}),
  };
}

/** A chosen curriculum's name: the catalogue's group name, or its programme if the catalogue lacks it. */
export const curriculumName = (curriculum: Curriculum, catalog: ReadonlyMap<string, AsioGroup>): string =>
  catalog.get(curriculum.asioId)?.name ?? programmeTitle(curriculum);

/** A curriculum in the result: its rank in the search (null if the search did not choose it) and what overlaps the best time. */
export type CurriculumOutcome = { rank: number | null; curriculum: Curriculum; clashes: SearchResult["unsuitableGroups"] };

/**
 * The search's curricula in rank order, each with its clashes (none: the time suits it), as US-012
 * asks. Groups the backend names that the search did not choose come last, by first appearance.
 */
export function rankOutcomes(chosen: readonly Curriculum[], unsuitable: SearchResult["unsuitableGroups"]): CurriculumOutcome[] {
  const outcomes = chosen.map((curriculum, i) => ({
    rank: i + 1,
    curriculum,
    clashes: unsuitable.filter((u) => u.curriculum.asioId === curriculum.asioId),
  }));
  const extra = new Map<string, CurriculumOutcome>();
  for (const u of unsuitable) {
    if (chosen.some((c) => c.asioId === u.curriculum.asioId)) continue;
    const outcome = extra.get(u.curriculum.asioId) ?? { rank: null, curriculum: u.curriculum, clashes: [] };
    outcome.clashes.push(u);
    extra.set(u.curriculum.asioId, outcome);
  }
  return [...outcomes, ...extra.values()];
}
