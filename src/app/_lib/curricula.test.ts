import { describe, expect, it } from "vitest";
import type { AsioGroup } from "@/app/_ports/ports";
import {
  curriculumName,
  curriculumOf,
  curriculumPath,
  distinct,
  searchCurricula,
  shortName,
  withCourses,
  type CurriculumFilter,
} from "./curricula";

const group = (asioId: string, name: string, change: Partial<AsioGroup> = {}): AsioGroup => ({
  asioId,
  name,
  programmeCode: asioId.replace(/-.*$/, ""),
  university: "TLÜ",
  building: "Peahoone",
  institute: "DTI",
  degreeLevel: "Bakalaureuseõpe",
  programme: "Informaatika",
  courses: [],
  ...change,
});

const CATALOG = [
  group("IFIFB-10", "Informaatika 10. õ.-a."),
  group("IFIFB-2", "Informaatika 2. õ.-a."),
  group("IFIFB-1", "Informaatika 1. õ.-a."),
  group("IFIFB_ta-1", "Informaatika (Tarkvaraarendus) 1. õ.-a.", { programmeCode: "IFIFB_ta", specialisation: "Tarkvaraarendus" }),
  group("INITB-1", "Infoteadus 1. õ.-a.", { programme: "Infoteadus" }),
  group("BFMB-1", "Audiovisuaalne meedia 1. õ.-a.", { programme: "Audiovisuaalne meedia", institute: "BFM", building: "Nova" }),
  group("IFIMM-1", "Infotehnoloogia juhtimine 1. õ.-a.", { programme: "Infotehnoloogia juhtimine", degreeLevel: "Magistriõpe" }),
];
const ALL: CurriculumFilter = { degreeLevel: "Bakalaureuseõpe", university: "", building: "", institute: "", query: "" };
const titles = (filter: Partial<CurriculumFilter>) => searchCurricula(CATALOG, { ...ALL, ...filter }).map((b) => b.title);

describe("searchCurricula", () => {
  it("lists one degree level as blocks per curriculum, by title, with the groups in numeric order", () => {
    const blocks = searchCurricula(CATALOG, ALL);

    expect(blocks.map((b) => b.title)).toEqual([
      "Audiovisuaalne meedia",
      "Informaatika",
      "Informaatika (Tarkvaraarendus)",
      "Infoteadus",
    ]);
    expect(blocks[1]).toMatchObject({ programmeCode: "IFIFB", path: "TLÜ › Peahoone › DTI › Bakalaureuseõpe" });
    expect(blocks[1].groups.map((g) => g.asioId)).toEqual(["IFIFB-1", "IFIFB-2", "IFIFB-10"]);
  });

  it("filters by place", () => {
    expect(titles({ institute: "BFM" })).toEqual(["Audiovisuaalne meedia"]);
    expect(titles({ building: "Peahoone", institute: "DTI" })).toHaveLength(3);
    expect(titles({ university: "EKA" })).toEqual([]);
    expect(titles({ degreeLevel: "Magistriõpe" })).toEqual(["Infotehnoloogia juhtimine"]);
  });

  it.each([
    ["the programme, in any case", "informaatika", ["Informaatika", "Informaatika (Tarkvaraarendus)"]],
    ["the specialisation", "tarkvara", ["Informaatika (Tarkvaraarendus)"]],
    ["a group code, without punctuation", "ififb 2", ["Informaatika"]],
    ["the curriculum code", "INITB", ["Infoteadus"]],
    ["nothing", "keemia", []],
  ])("finds %s", (_, query, expected) => {
    expect(titles({ query })).toEqual(expected);
  });
});

describe("chosen curricula", () => {
  it("keeps the data model fields of a catalogue group, without courses", () => {
    expect(curriculumOf(CATALOG[3])).toEqual({
      asioId: "IFIFB_ta-1",
      university: "TLÜ",
      building: "Peahoone",
      institute: "DTI",
      degreeLevel: "Bakalaureuseõpe",
      programme: "Informaatika",
      specialisation: "Tarkvaraarendus",
    });
    expect(curriculumOf(CATALOG[0])).not.toHaveProperty("specialisation");
  });

  it("adds courses, and leaves them out again when none are chosen", () => {
    const course = { code: "IFI6001.DT", name: "Andmebaasid" };
    const chosen = withCourses(curriculumOf(CATALOG[2]), [course]);

    expect(chosen.courses).toEqual([course]);
    expect(withCourses(chosen, [])).not.toHaveProperty("courses");
  });

  it("is named by the catalogue, or by its programme once the catalogue lacks it", () => {
    const catalog = new Map(CATALOG.map((g) => [g.asioId, g]));
    const chosen = curriculumOf(CATALOG[3]);

    expect(curriculumName(chosen, catalog)).toBe("Informaatika (Tarkvaraarendus) 1. õ.-a.");
    expect(curriculumName(chosen, new Map())).toBe("Informaatika (Tarkvaraarendus)");
    expect(curriculumPath(chosen)).toBe("TLÜ › Peahoone › DTI › Bakalaureuseõpe");
  });

  it.each([
    ["Informaatika 1. õ.-a.", "Informaatika", "1. õ.-a."],
    ["Andragoogika (osakoormus) 1. õ.-a.", "Andragoogika", "(osakoormus) 1. õ.-a."],
    ["Interdistsiplinaarsed sotsiaalteadused, 1.õ.-a.", "Interdistsiplinaarsed sotsiaalteadused", "1.õ.-a."],
    ["Infoteadus", "Infoteadus", "Infoteadus"],
    ["Law Helsinki 1.õ.-a.", "Õigusteadus", "Law Helsinki 1.õ.-a."],
  ])("shortens %j in the block %j to %j", (name, title, short) => {
    expect(shortName(group("X-1", name), title)).toBe(short);
  });

  it("lists different values in their first order", () => {
    expect(distinct(["Bakalaureuseõpe", "Magistriõpe", "Bakalaureuseõpe"])).toEqual(["Bakalaureuseõpe", "Magistriõpe"]);
  });
});
