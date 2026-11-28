import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendContext } from "@/app/_ports/backend";
import type { Backend } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { curriculumOf } from "@/app/_lib/curricula";
import { SearchForm, type Submission } from "./search-form";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

beforeEach(() => vi.mocked(toast.error).mockClear());

async function renderForm(backend: Backend = createStubBackend()) {
  const onSubmit = vi.fn<(submission: Submission) => void>();
  render(
    <BackendContext value={backend}>
      <SearchForm onSubmit={onSubmit} />
    </BackendContext>,
  );
  await act(async () => {}); // let the backend answer
  return { backend, onSubmit, user: userEvent.setup() };
}

const roomsCard = () => within(screen.getByRole("region", { name: "Ruumid" }));
const searchRooms = () =>
  within(screen.getByRole("list", { name: "Otsingu ruumid" })).getAllByRole("listitem").map((li) => li.textContent?.slice(2, 10));

describe("SearchForm", () => {
  it("shows the event, the rooms and the candidate times, in the order of the mockup", async () => {
    await renderForm();

    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Üritus",
      "Ruumid",
      "Kandidaatajad",
      "Õppekavad ja ained",
      "Kokkuvõte",
    ]);
  });

  it("checks the candidate ranges against the chosen duration", async () => {
    const { user } = await renderForm();
    fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });
    const range = screen.getByLabelText("Päev 1, vahemik 1: algus"); // 10:00–12:00

    await user.selectOptions(screen.getByLabelText("Kestus"), "2 h");
    expect(range).toHaveAttribute("aria-invalid", "false");

    await user.selectOptions(screen.getByLabelText("Kestus"), "2 h 30 min");
    expect(range).toHaveAttribute("aria-invalid", "true");
    expect(range).toHaveAccessibleDescription("Vahemik on lühem kui ürituse kestus (2 h 30 min).");
  });

  it("suggests the event types from the backend, most used first", async () => {
    const backend = createStubBackend();
    backend.eventTypes.popular = async () => [
      { eventType: "Koosolek", useCount: 42 },
      { eventType: "Seminar", useCount: 17 },
    ];
    await renderForm(backend);
    const list = document.getElementById(screen.getByLabelText("Ürituse tüüp").getAttribute("list") ?? "");

    expect([...(list?.querySelectorAll("option") ?? [])].map((o) => o.value)).toEqual(["Koosolek", "Seminar"]);
  });

  it("asks for a first group when the user has none", async () => {
    await renderForm();

    expect(screen.getByText("Sul pole veel ruumigruppe. Loo esimene nupuga „+ Uus grupp“.")).toBeInTheDocument();
    expect(roomsCard().getByRole("button", { name: "Muuda gruppi" })).toBeDisabled();
  });

  it("keeps every input while the editor is open, and returns to the rooms after cancel", async () => {
    const { user } = await renderForm();
    await user.type(screen.getByLabelText("Ürituse nimi (valikuline)"), "Nõukogu");
    fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });

    await user.click(roomsCard().getByRole("button", { name: "+ Uus grupp" }));
    expect(screen.getByRole("heading", { level: 1, name: "Uus ruumigrupp" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Uus otsing" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tühista" }));
    expect(screen.getByLabelText("Ürituse nimi (valikuline)")).toHaveValue("Nõukogu");
    expect(screen.getByLabelText("Päev 1: kuupäev")).toHaveValue("2026-12-01");
    expect(screen.getByRole("heading", { level: 2, name: "Ruumid" })).toHaveFocus();
  });

  it("selects a saved group, ranks its rooms for this search only, and edits it", async () => {
    const { backend, user } = await renderForm();
    await user.click(roomsCard().getByRole("button", { name: "+ Uus grupp" }));
    await user.type(screen.getByLabelText("Grupi nimi"), "Aulad");
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-301 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-201 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(screen.getByLabelText("Salvestatud ruumigrupp")).toHaveDisplayValue("Aulad · 2 ruumi");
    expect(searchRooms()).toEqual(["DEMO-301", "DEMO-201"]);

    await user.click(screen.getByRole("button", { name: "DEMO-201: liiguta üles" }));
    expect(searchRooms()).toEqual(["DEMO-201", "DEMO-301"]);
    expect((await backend.roomGroups.list())[0].roomCodes).toEqual(["DEMO-301", "DEMO-201"]);

    await user.click(roomsCard().getByRole("button", { name: "Muuda gruppi" }));
    expect(screen.getByRole("heading", { level: 1, name: "Ruumigrupp: Aulad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "DEMO-201: eemalda grupist" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(screen.getByLabelText("Salvestatud ruumigrupp")).toHaveDisplayValue("Aulad · 1 ruum");
    expect(searchRooms()).toEqual(["DEMO-301"]);
  });

  it("marks rooms smaller than the attendee count", async () => {
    const { user } = await renderForm();
    await user.type(screen.getByLabelText("Osalejaid (valikuline)"), "10");
    await user.click(roomsCard().getByRole("button", { name: "+ Uus grupp" }));

    expect(screen.getByText("8 kohta · liiga väike")).toBeInTheDocument();
  });

  it("says which data could not be loaded", async () => {
    const backend = createStubBackend();
    backend.roomGroups.list = () => Promise.reject(new Error("offline"));
    await renderForm(backend);

    expect(toast.error).toHaveBeenCalledWith("Ruumigruppe ei õnnestunud laadida.", { autoClose: false });
    expect(screen.getByText("Salvestatud gruppe ei õnnestunud laadida. Uue grupi saad siiski luua.")).toBeInTheDocument();
    expect(roomsCard().getByRole("button", { name: "+ Uus grupp" })).toBeEnabled();
  });

  describe("summary card", () => {
    const summary = () => within(screen.getByRole("complementary", { name: "Kokkuvõte" }));

    it("lists the missing parts, keeps the button disabled and takes the focus to a missing part", async () => {
      const { user } = await renderForm();

      expect(summary().getByRole("button", { name: "Leia aeg ja ruum" })).toBeDisabled();
      expect(summary().getByText("tüüp valimata · 1 h 30 min")).toBeInTheDocument();
      await user.click(summary().getByRole("button", { name: "Vali vähemalt üks ruum (1.1)" }));
      expect(screen.getByRole("heading", { level: 2, name: "Ruumid" })).toHaveFocus();
      await user.click(summary().getByRole("button", { name: "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)" }));
      expect(screen.getByRole("heading", { level: 2, name: "Kandidaatajad" })).toHaveFocus();
      await user.click(summary().getByRole("button", { name: "Ürituse tüüp on valimata" }));
      expect(screen.getByRole("heading", { level: 2, name: "Üritus" })).toHaveFocus();
    });

    it("hands over the search once the required parts are ready", async () => {
      const backend = createStubBackend();
      const saved = await backend.roomGroups.create("Aulad", ["DEMO-301", "DEMO-201"]);
      if (!saved.ok) throw new Error();
      const { onSubmit, user } = await renderForm(backend);
      await user.type(screen.getByLabelText("Ürituse tüüp"), " Koosolek ");
      await user.selectOptions(screen.getByLabelText("Salvestatud ruumigrupp"), "Aulad · 2 ruumi");
      await user.click(screen.getByRole("button", { name: "DEMO-201: liiguta üles" }));
      fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });

      expect(summary().getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "Ruumid valitud (1.1)",
        "Vähemalt üks ajavahemik (1.2)",
        "Ürituse tüüp ja kestus valitud",
      ]);
      await user.click(summary().getByRole("button", { name: "Leia aeg ja ruum" }));

      const [submission] = onSubmit.mock.calls[0];
      expect(submission.input).toEqual({
        name: null,
        eventType: "Koosolek",
        durationMinutes: 90,
        attendees: null,
        roomCodes: ["DEMO-201", "DEMO-301"],
        roomGroupId: saved.group.id,
        complexityWeights: {},
        curricula: null,
        curriculumGroupId: null,
        csvFilename: null,
        timeWindows: [
          {
            source: "tool",
            start: "2026-11-30T22:00:00Z",
            end: "2026-12-01T22:00:00Z",
            days: [
              {
                start: "2026-11-30T22:00:00Z",
                end: "2026-12-01T22:00:00Z",
                ranges: [{ start: "2026-12-01T08:00:00Z", end: "2026-12-01T10:00:00Z" }],
              },
            ],
          },
        ],
      });
      expect(submission.rooms.map((r) => r.code)).toEqual(["DEMO-201", "DEMO-301"]);
      expect(submission.summary.map((row) => row.value)).toEqual([
        "Koosolek · 1 h 30 min",
        "2 ruumi · Aulad",
        "1 päev · 1 vahemik",
        "ei arvestata",
        "vaikimisi",
      ]);
    });
  });

  describe("curricula", () => {
    const curriculaCard = () => within(screen.getByRole("region", { name: "Õppekavad ja ained" }));

    it("are optional, and a first group is built in the editor and then chosen", async () => {
      const { user } = await renderForm();
      expect(screen.getByLabelText("Salvestatud õppekavade grupp")).toHaveDisplayValue("Õppekavu ei arvestata");
      expect(curriculaCard().getByText(/Sul pole veel õppekavade gruppe/)).toBeInTheDocument();

      await user.click(curriculaCard().getByRole("button", { name: "+ Uus grupp" }));
      expect(screen.getByRole("heading", { level: 1, name: "Uus õppekavade grupp" })).toHaveFocus();
      await user.type(screen.getByLabelText("Grupi nimi"), "Digi");
      await user.click(screen.getByRole("checkbox", { name: "Demo infoteadus 1. õ.-a." }));
      await user.click(screen.getByRole("checkbox", { name: "Demo informaatika 1. õ.-a." }));
      await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

      expect(screen.getByRole("heading", { level: 2, name: "Õppekavad ja ained" })).toHaveFocus();
      expect(screen.getByLabelText("Salvestatud õppekavade grupp")).toHaveDisplayValue("Digi · 2 õppekava");
      expect(
        within(screen.getByRole("list", { name: "Otsingu õppekavad" })).getAllByRole("listitem").map((li) => li.textContent),
      ).toEqual(["1.Demo infoteadus 1. õ.-a.DEMOITB-1kõik ained", "2.Demo informaatika 1. õ.-a.DEMOINF-1kõik ained"]);
      expect(within(screen.getByRole("complementary", { name: "Kokkuvõte" })).getByText("2 õppekava · Digi")).toBeInTheDocument();
    });

    it("say which data could not be loaded", async () => {
      const backend = createStubBackend();
      backend.curricula.list = () => Promise.reject(new Error("offline"));
      backend.curriculumGroups.list = () => Promise.reject(new Error("offline"));
      await renderForm(backend);

      expect(toast.error).toHaveBeenCalledWith("Õppekavade nimekirja ei õnnestunud laadida.", { autoClose: false });
      expect(toast.error).toHaveBeenCalledWith("Õppekavade gruppe ei õnnestunud laadida.", { autoClose: false });
      expect(curriculaCard().getByText(/Salvestatud gruppe ei õnnestunud laadida/)).toBeInTheDocument();
      expect(curriculaCard().getByRole("button", { name: "+ Uus grupp" })).toBeEnabled();
    });

    it("are sent with the search, and not when the user chooses none", async () => {
      const backend = createStubBackend();
      await backend.roomGroups.create("Aulad", ["DEMO-301"]);
      const [first] = await backend.curricula.list();
      const saved = await backend.curriculumGroups.create("Digi", [curriculumOf(first)]);
      if (!saved.ok) throw new Error();
      const { onSubmit, user } = await renderForm(backend);
      await user.type(screen.getByLabelText("Ürituse tüüp"), "Koosolek");
      await user.selectOptions(screen.getByLabelText("Salvestatud ruumigrupp"), "Aulad · 1 ruum");
      fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });
      await user.selectOptions(screen.getByLabelText("Salvestatud õppekavade grupp"), "Digi · 1 õppekava");
      await user.click(screen.getByRole("button", { name: "Leia aeg ja ruum" }));

      expect(onSubmit.mock.calls[0][0].input).toMatchObject({ curricula: [curriculumOf(first)], curriculumGroupId: saved.group.id });
      expect(onSubmit.mock.calls[0][0].asioGroups).toEqual([first]);

      await user.selectOptions(screen.getByLabelText("Salvestatud õppekavade grupp"), "Õppekavu ei arvestata");
      await user.click(screen.getByRole("button", { name: "Leia aeg ja ruum" }));
      expect(onSubmit.mock.calls[1][0].input).toMatchObject({ curricula: null, curriculumGroupId: null });
    });
  });
});
