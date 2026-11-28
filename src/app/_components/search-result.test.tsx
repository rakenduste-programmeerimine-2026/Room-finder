import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Best, Room, SearchResult } from "@/app/_ports/ports";
import { NoResultView, SearchResultView, type SentSearch } from "./search-result";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.warning).mockClear();
});

const aula: Room = {
  code: "DEMO-301",
  capacity: 200,
  bookableForTeaching: false,
  aliases: ["Demo aula", "Demo konverentsisaal"],
  complexity: "university_permission",
  eventTypes: [],
};
const sent: SentSearch = {
  input: {
    name: "Nõukogu",
    eventType: "Koosolek",
    durationMinutes: 90,
    attendees: 12,
    roomCodes: ["DEMO-101", "DEMO-301"],
    roomGroupId: "g1",
    complexityWeights: {},
    timeWindows: [],
    curricula: null,
    curriculumGroupId: null,
  },
  rooms: [aula],
  summary: [{ label: "Ruumid", value: "2 ruumi · Aulad" }],
  at: "2026-11-25T19:40:00Z",
};
const best: Best = { roomCode: "DEMO-301", start: "2026-12-01T12:00:00Z", end: "2026-12-01T13:30:00Z", score: 0.92 };
const informaatika = {
  university: "TLÜ",
  building: "Peahoone",
  institute: "DTI",
  degreeLevel: "Bakalaureuseõpe",
  programme: "Informaatika",
  asioId: "IFIFB-1",
};
const empty: SearchResult = { best, unsuitableGroups: [], warnings: [] };

function renderResult(result: SearchResult = empty, change: Partial<Best> = {}) {
  const onEdit = vi.fn();
  const onNew = vi.fn();
  render(<SearchResultView sent={sent} best={{ ...best, ...change }} result={result} onEdit={onEdit} onNew={onNew} />);
  return { onEdit, onNew, user: userEvent.setup() };
}

const bestCard = () => screen.getByRole("region", { name: "Parim aeg ja ruum" });

describe("SearchResultView", () => {
  it("shows the best time in Tallinn time with UTC, the room, its rank and how to book it (US-012)", () => {
    renderResult();

    expect(screen.getByRole("heading", { level: 1, name: "Parim aeg ja ruum" })).toHaveFocus();
    expect(screen.getByText("Nõukogu · Koosolek · 12 inimest · otsitud 25. november 2026 21:40")).toBeInTheDocument();
    expect(bestCard()).toHaveTextContent("Teisipäev, 1. detsember 2026");
    expect(bestCard()).toHaveTextContent("14:00 – 15:30");
    expect(bestCard()).toHaveTextContent("Tallinna aja järgi · UTC 12:00 – 13:30");
    expect(bestCard()).toHaveTextContent("DEMO-301 · Demo aula · Demo konverentsisaal");
    expect(bestCard()).toHaveTextContent("200 kohtaÜlikooli luba");
    expect(bestCard()).toHaveTextContent("sinu 2. eelistus");
    expect(bestCard()).toHaveTextContent("Skoor 0,92");
    expect(bestCard()).toHaveTextContent(
      "Broneerimine: ruumi jaoks on vaja ülikooli luba. Rakendus ise ruumi ei broneeri.",
    );
    expect(within(screen.getByRole("region", { name: "Otsingu sisendid" })).getByText("2 ruumi · Aulad")).toBeInTheDocument();
  });

  it.each([
    ["at local midnight", "2026-11-30T22:00:00Z", "2026-11-30T23:30:00Z", "Teisipäev, 1. detsember 2026", "00:00 – 01:30"],
    ["on the day of the spring change", "2026-03-29T01:00:00Z", "2026-03-29T02:30:00Z", "Pühapäev, 29. märts 2026", "04:00 – 05:30"],
    ["ending at local midnight", "2026-07-15T19:30:00Z", "2026-07-15T21:00:00Z", "Kolmapäev, 15. juuli 2026", "22:30 – 00:00"],
  ])("shows a time %s in Tallinn time", (_, start, end, day, times) => {
    renderResult(empty, { start, end });

    expect(bestCard()).toHaveTextContent(day);
    expect(bestCard()).toHaveTextContent(times);
  });

  it("copies the time and room", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "Kopeeri aeg ja ruum" }));

    expect(await navigator.clipboard.readText()).toBe(
      "Teisipäev, 1. detsember 2026, 14:00 – 15:30 (Tallinna aja järgi), ruum DEMO-301 · Demo aula",
    );
    expect(toast.success).toHaveBeenCalledWith("Aeg ja ruum kopeeritud.");
  });

  it("goes back to the inputs or to a new search", async () => {
    const { onEdit, onNew, user } = renderResult();
    await user.click(screen.getAllByRole("button", { name: "Muuda sisendeid" })[1]);
    await user.click(screen.getByRole("button", { name: "Uus otsing" }));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(onNew).toHaveBeenCalledOnce();
  });

  it("says that no curricula were checked when the search had none", () => {
    renderResult();

    expect(screen.getByRole("region", { name: "Kellele see aeg ei sobi" })).toHaveTextContent(
      "Õppekavu ei valitud, seega tundidega kattumist ei kontrollitud.",
    );
    expect(screen.getByText("Hoiatusi pole.")).toBeInTheDocument();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("lists the groups the time does not suit, with their class times in Tallinn time", () => {
    renderResult({
      best,
      unsuitableGroups: [
        {
          curriculum: { ...informaatika, asioId: "IFIFB-2" },
          course: { code: "IFI6001.DT", name: "Andmebaasid" },
          conflicts: [{ start: "2026-12-01T12:15:00Z", end: "2026-12-01T13:45:00Z" }],
        },
        {
          curriculum: { ...informaatika, asioId: "INITB-1", programme: "Infoteadus", specialisation: "Infokorraldus" },
          conflicts: [
            { start: "2026-12-01T11:00:00Z", end: "2026-12-01T12:30:00Z" },
            { start: "2026-12-01T13:00:00Z", end: "2026-12-01T14:00:00Z" },
          ],
        },
      ],
      warnings: [],
    });
    const region = screen.getByRole("region", { name: "Kellele see aeg ei sobi" });
    const rows = within(region).getAllByRole("listitem");

    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent("Kellele see aeg ei sobi2 gruppi");

    expect(rows[0]).toHaveTextContent("Informaatika (Bakalaureuseõpe)IFIFB-2Kattub: 14:15 – 15:45 · Andmebaasid");
    expect(rows[1]).toHaveTextContent("Infoteadus, Infokorraldus (Bakalaureuseõpe)INITB-1Kattub: 13:00 – 14:30, 15:00 – 16:00");
  });

  it("counts one group in the singular", () => {
    renderResult({ best, unsuitableGroups: [{ curriculum: informaatika, conflicts: [] }], warnings: [] });
    expect(screen.getByRole("heading", { level: 2, name: /^Kellele see aeg ei sobi/ })).toHaveTextContent("1 grupp");
  });

  it("shows the next-semester warning in the box and as a toast", () => {
    renderResult({ best, unsuitableGroups: [], warnings: ["next_semester"] });
    const text =
      "Aeg on järgmisel poolaastal: õppekavade koostajatel on ruumide osas eelisjärjekord ja õppetöös kasutatava ruumi broneerimisel on oht ruum kaotada.";

    expect(within(screen.getByRole("region", { name: "Hoiatused" })).getByText(text)).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith(text, { toastId: "next-semester" });
  });

  it("shows a room that is not in the catalogue by its code, without a booking hint", () => {
    renderResult(empty, { roomCode: "X-1" });

    expect(bestCard()).toHaveTextContent("X-1");
    expect(bestCard()).not.toHaveTextContent("Broneerimine");
    expect(bestCard()).not.toHaveTextContent("eelistus");
  });
});

describe("NoResultView", () => {
  it("suggests what to change and offers both ways back (US-013)", async () => {
    const onEdit = vi.fn();
    const onNew = vi.fn();
    render(<NoResultView onEdit={onEdit} onNew={onNew} />);
    const user = userEvent.setup();

    expect(screen.getByRole("heading", { level: 1, name: "Sobivat aega ja ruumi ei leitud" })).toHaveFocus();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Muuda sisendeid" }));
    await user.click(screen.getByRole("button", { name: "Uus otsing" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onNew).toHaveBeenCalledOnce();
  });
});
