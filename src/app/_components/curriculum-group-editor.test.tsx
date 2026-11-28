import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { curriculumOf } from "@/app/_lib/curricula";
import { BackendContext } from "@/app/_ports/backend";
import type { AsioGroup, Backend, CurriculumGroup } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { CurriculumGroupEditor } from "./curriculum-group-editor";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

let backend: Backend;
let catalog: AsioGroup[];

beforeEach(async () => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  backend = createStubBackend();
  catalog = await backend.curricula.list();
});

function renderEditor({ group = null as CurriculumGroup | null, groups = [] as CurriculumGroup[] } = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <BackendContext value={backend}>
      <CurriculumGroupEditor catalog={catalog} group={group} groups={groups} onSaved={onSaved} onCancel={onCancel} />
    </BackendContext>,
  );
  return { onSaved, onCancel, user: userEvent.setup() };
}

const found = () => within(screen.getByRole("list", { name: "Leitud õppekavad" }));
const blockTitles = () =>
  found().queryAllByRole("group").map((fieldset) => fieldset.querySelector("legend")?.textContent);
const chosen = () =>
  screen.queryAllByRole("button", { name: /: liiguta üles$/ }).map((b) => b.getAttribute("aria-label")?.split(":")[0]);
const of = (asioId: string) => curriculumOf(catalog.find((g) => g.asioId === asioId) as AsioGroup);

describe("CurriculumGroupEditor", () => {
  it("opens on the first degree level, with the focus on its heading and the curricula by title", () => {
    renderEditor();

    expect(screen.getByRole("heading", { level: 1, name: "Uus õppekavade grupp" })).toHaveFocus();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Bakalaureuseõpe", "Magistriõpe", "Doktoriõpe"]);
    expect(screen.getByRole("tab", { name: "Bakalaureuseõpe" })).toHaveAttribute("aria-selected", "true");
    expect(blockTitles()).toEqual([
      "Demo audiovisuaalne meediaDEMOAVM",
      "Demo informaatikaDEMOINF",
      "Demo informaatika (Tarkvaraarendus)DEMOINF_ta",
      "Demo infoteadusDEMOITB",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Leitud õppekavu: 4");
    expect(found().getByRole("checkbox", { name: "Demo infoteadus (osakoormus) 1. õ.-a." }).parentElement).toHaveTextContent(
      "(osakoormus) 1. õ.-a.",
    );
  });

  it("switches the degree level by click and with the arrow keys", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("tab", { name: "Magistriõpe" }));
    expect(blockTitles()).toEqual(["Demo infotehnoloogia juhtimineDEMOINFM"]);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Doktoriõpe" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Doktoriõpe" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Bakalaureuseõpe" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Doktoriõpe" })).toHaveFocus();
  });

  it("clears the place filters when the degree level changes, so the new tab is not empty", async () => {
    const { user } = renderEditor();
    await user.selectOptions(screen.getByLabelText("Maja"), "Demo maja B");
    await user.click(screen.getByRole("tab", { name: "Magistriõpe" }));

    expect(screen.getByLabelText("Maja")).toHaveValue("");
    expect(blockTitles()).toEqual(["Demo infotehnoloogia juhtimineDEMOINFM"]);
  });

  it("filters by place and finds by name or code", async () => {
    const { user } = renderEditor();
    await user.selectOptions(screen.getByLabelText("Maja"), "Demo maja B");
    expect(blockTitles()).toEqual(["Demo audiovisuaalne meediaDEMOAVM"]);

    await user.selectOptions(screen.getByLabelText("Maja"), "Kõik");
    await user.type(screen.getByLabelText("Otsi eriala, suuna või koodi järgi"), "tarkvara");
    expect(blockTitles()).toEqual(["Demo informaatika (Tarkvaraarendus)DEMOINF_ta"]);

    await user.clear(screen.getByLabelText("Otsi eriala, suuna või koodi järgi"));
    await user.type(screen.getByLabelText("Otsi eriala, suuna või koodi järgi"), "demoitb 1ok");
    expect(blockTitles()).toEqual(["Demo infoteadusDEMOITB"]);
  });

  it("adds groups in the order they are checked, ranks them and removes them", async () => {
    const { user } = renderEditor();
    await user.click(found().getByRole("checkbox", { name: "Demo informaatika 2. õ.-a." }));
    await user.click(found().getByRole("checkbox", { name: "Demo infoteadus 1. õ.-a." }));
    expect(chosen()).toEqual(["DEMOINF-2", "DEMOITB-1"]);
    expect(screen.getByText("2 õppekava · max 200")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "DEMOITB-1: liiguta üles" }));
    expect(chosen()).toEqual(["DEMOITB-1", "DEMOINF-2"]);

    await user.click(found().getByRole("checkbox", { name: "Demo informaatika 2. õ.-a." }));
    expect(chosen()).toEqual(["DEMOITB-1"]);
    await user.click(screen.getByRole("button", { name: "DEMOITB-1: eemalda grupist" }));
    expect(found().getByRole("checkbox", { name: "Demo infoteadus 1. õ.-a." })).not.toBeChecked();
  });

  it("chooses some courses of a curriculum, and the whole curriculum again when none is checked", async () => {
    const { user } = renderEditor();
    await user.click(found().getByRole("checkbox", { name: "Demo informaatika 2. õ.-a." }));
    const row = () => within(screen.getByRole("list", { name: "Grupi õppekavad" }));
    expect(row().getByText("kõik ained")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "DEMOINF-2: vali aineid" }));
    await user.click(row().getByRole("checkbox", { name: "DEMOINF.203 Demo statistika" }));
    await user.click(row().getByRole("checkbox", { name: "DEMOINF.201 Demo andmebaasid" }));
    await user.click(screen.getByRole("button", { name: "DEMOINF-2: ained valitud" }));

    expect(row().getAllByRole("listitem")[0]).toHaveTextContent("Ained:Demo andmebaasidDemo statistika");
    await user.click(screen.getByRole("button", { name: "DEMOINF-2: vali aineid" }));
    await user.click(row().getByRole("checkbox", { name: "DEMOINF.201 Demo andmebaasid" }));
    await user.click(row().getByRole("checkbox", { name: "DEMOINF.203 Demo statistika" }));
    expect(row().getByText("kõik ained")).toBeInTheDocument();
  });

  it("saves a new group with its curricula and courses", async () => {
    const { user, onSaved } = renderEditor();
    await user.type(screen.getByLabelText("Grupi nimi"), " Digi bakalaureus ");
    await user.click(found().getByRole("checkbox", { name: "Demo informaatika 2. õ.-a." }));
    await user.click(screen.getByRole("button", { name: "DEMOINF-2: vali aineid" }));
    await user.click(screen.getByRole("checkbox", { name: "DEMOINF.201 Demo andmebaasid" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    const curricula = [{ ...of("DEMOINF-2"), courses: [{ code: "DEMOINF.201", name: "Demo andmebaasid" }] }];
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "Digi bakalaureus", curricula }));
    expect(toast.success).toHaveBeenCalledWith("Grupp salvestatud: „Digi bakalaureus“ on nüüd valikus.");
    expect(await backend.curriculumGroups.list()).toHaveLength(1);
  });

  it("asks for a name and a curriculum before saving", async () => {
    const { user, onSaved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Gruppi ei salvestatud: Anna grupile nimi. Vali gruppi vähemalt üks õppekava.");
    expect(screen.getByLabelText("Grupi nimi")).toHaveAccessibleDescription("Anna grupile nimi.");
    expect(screen.getByText("Vali gruppi vähemalt üks õppekava.")).toBeInTheDocument();
  });

  it("keeps the changes when saving fails", async () => {
    backend = { ...backend, curriculumGroups: { ...backend.curriculumGroups, create: () => Promise.reject(new Error("offline")) } };
    const { user, onSaved } = renderEditor();
    await user.type(screen.getByLabelText("Grupi nimi"), "Digi");
    await user.click(found().getByRole("checkbox", { name: "Demo informaatika 1. õ.-a." }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Gruppi ei õnnestunud salvestada. Sinu muudatused on alles, proovi uuesti.");
    expect(chosen()).toEqual(["DEMOINF-1"]);
    expect(screen.getByRole("button", { name: "Salvesta grupp" })).toBeEnabled();
  });

  it("says when the catalogue is empty", () => {
    catalog = [];
    renderEditor();
    expect(screen.getByRole("status")).toHaveTextContent("Õppekavade nimekiri on tühi: see laadib veel või ei õnnestunud laadida.");
  });

  describe("an existing group", () => {
    async function existing() {
      const saved = await backend.curriculumGroups.create("Digi", [of("DEMOINF-1"), of("DEMOITB-1")]);
      if (!saved.ok) throw new Error();
      return saved.group;
    }

    it("shows its curricula in rank order and offers saving under a new name or overwriting", async () => {
      const group = await existing();
      renderEditor({ group, groups: [group] });

      expect(screen.getByRole("heading", { level: 1, name: "Õppekavade grupp: Digi" })).toBeInTheDocument();
      expect(chosen()).toEqual(["DEMOINF-1", "DEMOITB-1"]);
      expect(found().getByRole("checkbox", { name: "Demo informaatika 1. õ.-a." })).toBeChecked();
      expect(screen.queryByRole("button", { name: "Salvesta grupp" })).not.toBeInTheDocument();
    });

    it("saves a copy under a new name and keeps the source group, but not under the same name", async () => {
      const group = await existing();
      const { user, onSaved } = renderEditor({ group, groups: [group] });
      await user.click(screen.getByRole("button", { name: "DEMOITB-1: liiguta üles" }));
      await user.click(screen.getByRole("button", { name: "Salvesta uue nimega" }));
      expect(toast.error).toHaveBeenCalledWith("Nimi on juba kasutusel: sul on juba grupp nimega „Digi“. Vali teine nimi.");

      await user.clear(screen.getByLabelText("Grupi nimi"));
      await user.type(screen.getByLabelText("Grupi nimi"), "Digi 2");
      await user.click(screen.getByRole("button", { name: "Salvesta uue nimega" }));

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "Digi 2", curricula: [of("DEMOITB-1"), of("DEMOINF-1")] }));
      expect((await backend.curriculumGroups.list()).map((g) => g.name).sort()).toEqual(["Digi", "Digi 2"]);
    });

    it("overwrites the source group under its id", async () => {
      const group = await existing();
      const { user, onSaved } = renderEditor({ group, groups: [group] });
      await user.click(screen.getByRole("button", { name: "DEMOINF-1: eemalda grupist" }));
      await user.click(screen.getByRole("button", { name: "Kirjuta lähtegrupp üle" }));

      expect(onSaved).toHaveBeenCalledWith({ id: group.id, name: "Digi", curricula: [of("DEMOITB-1")] });
      expect(await backend.curriculumGroups.list()).toEqual([{ id: group.id, name: "Digi", curricula: [of("DEMOITB-1")] }]);
    });

    it("cancels without saving", async () => {
      const group = await existing();
      const { user, onCancel } = renderEditor({ group, groups: [group] });
      await user.click(screen.getByRole("button", { name: "DEMOINF-1: eemalda grupist" }));
      await user.click(screen.getByRole("button", { name: "Tühista" }));

      expect(onCancel).toHaveBeenCalled();
      expect((await backend.curriculumGroups.list())[0].curricula).toHaveLength(2);
    });
  });

  it.each<[number, boolean]>([[199, true], [200, false]])("with %i curricula, checking another is allowed: %s", (n, allowed) => {
    const curricula = Array.from({ length: n }, (_, i) => ({ ...of("DEMOINF-1"), asioId: `X-${i}` }));
    renderEditor({ group: { id: "1", name: "Suur", curricula }, groups: [] });
    const box = found().getByRole("checkbox", { name: "Demo informaatika 2. õ.-a." });

    if (allowed) expect(box).toBeEnabled();
    else expect(box).toBeDisabled();
  });
});
