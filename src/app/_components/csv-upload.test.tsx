import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CSV_BYTES } from "@/app/_lib/csv";
import { BackendContext } from "@/app/_ports/backend";
import type { Backend, CsvCheck } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { SearchForm, type Submission } from "./search-form";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

let backend: Backend;

beforeEach(async () => {
  vi.mocked(toast.error).mockClear();
  backend = createStubBackend();
  await backend.roomGroups.create("Aulad", ["DEMO-301"]);
});

async function renderForm({ active = true } = {}) {
  const onSubmit = vi.fn<(submission: Submission) => void>();
  render(
    <BackendContext value={backend}>
      <SearchForm onSubmit={onSubmit} active={active} />
    </BackendContext>,
  );
  await act(async () => {}); // let the backend answer
  return { onSubmit, user: userEvent.setup() };
}

const csvFile = (name = "ajad.csv", size = 10) => new File([new Uint8Array(size)], name, { type: "text/csv" });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
const choose = async (file: File) => {
  fireEvent.change(fileInput(), { target: { files: [file] } });
  await act(async () => {}); // let the check answer
};
const summary = () => within(screen.getByRole("complementary", { name: "Kokkuvõte" }));
const timesCheck = () => summary().getAllByRole("listitem")[1];

/** Fills the other required parts: an event type and a room group. */
async function fillTheRest(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Ürituse tüüp"), "Koosolek");
  await user.selectOptions(screen.getByLabelText("Salvestatud ruumigrupp"), "Aulad · 1 ruum");
}

describe("CSV upload", () => {
  it("has its own tab with the format and a sample file to download", async () => {
    const { user } = await renderForm();
    expect(screen.getByRole("tab", { name: "Sisesta käsitsi" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Laadi CSV-fail" }));
    const panel = screen.getByRole("tabpanel", { name: "Laadi CSV-fail" });

    expect(within(panel).getByRole("heading", { name: /Faili formaat/ })).toBeInTheDocument();
    const sample = within(panel).getByRole("link", { name: "Lae alla näidis-CSV" });
    expect(sample).toHaveAttribute("download", "ajad-naidis.csv");
    expect(decodeURIComponent(sample.getAttribute("href") ?? "")).toMatch(/^data:text\/csv;charset=utf-8,date,start,end\n/);
    expect(screen.getByLabelText("Päev 1: kuupäev")).not.toBeVisible(); // hidden, so its input stays
  });

  it.each([
    ["ajad.txt", 10, "„ajad.txt“ ei ole CSV-fail. Vali .csv-laiendiga fail."],
    ["suur.csv", MAX_CSV_BYTES + 1, "„suur.csv“ on suurem kui 1 MB. Vähenda faili või sisesta ajad käsitsi."],
  ])("does not send %s of %i bytes", async (name, size, message) => {
    const check = vi.spyOn(backend.csvFiles, "check");
    await renderForm();
    await choose(csvFile(name, size));

    expect(check).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(message, { autoClose: false });
    expect(screen.getByRole("tab", { name: "Sisesta käsitsi" })).toHaveAttribute("aria-selected", "true");
  });

  it("sends a file of exactly 1 MB", async () => {
    const check = vi.spyOn(backend.csvFiles, "check");
    await renderForm();
    await choose(csvFile("ajad.csv", MAX_CSV_BYTES));
    expect(check).toHaveBeenCalledOnce();
  });

  it("uses an accepted file together with valid manual times, first the manual ones", async () => {
    const { onSubmit, user } = await renderForm();
    await fillTheRest(user);
    fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });
    await choose(csvFile());

    expect(screen.getByRole("tab", { name: "Laadi CSV-fail" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("3 rida · 2 päeva · server kontrollis faili")).toBeInTheDocument();
    const together = screen.getByRole("checkbox", { name: "Kasuta koos käsitsi sisestatud aegadega (1 päev)" });
    expect(together).toBeChecked();
    expect(summary().getByText("3 päeva · 4 vahemikku")).toBeInTheDocument();
    expect(summary().getByText("ajad.csv · 3 rida")).toBeInTheDocument();

    await user.click(summary().getByRole("button", { name: "Leia aeg ja ruum" }));
    expect(onSubmit.mock.calls[0][0].input.timeWindows.map((p) => p.source)).toEqual(["tool", "csv"]);
    expect(onSubmit.mock.calls[0][0].input.csvFilename).toBe("ajad.csv");

    await user.click(together);
    await user.click(summary().getByRole("button", { name: "Leia aeg ja ruum" }));
    expect(onSubmit.mock.calls[1][0].input.timeWindows.map((p) => p.source)).toEqual(["csv"]);
  });

  it("uses an accepted file alone when no manual times were entered (UI-9)", async () => {
    const { onSubmit, user } = await renderForm();
    await fillTheRest(user);
    await choose(csvFile());

    expect(screen.getByRole("checkbox", { name: /Kasuta koos/ })).not.toBeChecked();
    expect(timesCheck()).toHaveTextContent("Vähemalt üks ajavahemik (1.2)");
    await user.click(summary().getByRole("button", { name: "Leia aeg ja ruum" }));
    expect(onSubmit.mock.calls[0][0].input.timeWindows.map((p) => p.source)).toEqual(["csv"]);

    await user.click(screen.getByRole("checkbox", { name: /Kasuta koos/ }));
    expect(timesCheck()).toHaveTextContent("Paranda käsitsi sisestatud ajad või kasuta ainult CSV-faili (1.2)");
  });

  it("marks a rejected file, names its rows in a toast and does not use it", async () => {
    await renderForm();
    await choose(csvFile("ajad-viga.csv"));

    expect(toast.error).toHaveBeenCalledWith(
      "CSV-failis on 2 viga: rida 4: lõpp on enne algust; rida 9: kuupäeva 2026-02-30 ei ole kalendris.",
      { autoClose: false },
    );
    expect(screen.getByText("Rida 4: lõpp on enne algust · Rida 9: kuupäeva 2026-02-30 ei ole kalendris")).toBeInTheDocument();
    expect(summary().getByText("ajad-viga.csv · vigane, ei kasutata")).toBeInTheDocument();
    expect(timesCheck()).toHaveTextContent("Lisa kuupäev ja paranda vigased ajavahemikud (1.2)");
  });

  it("holds the search while a file is checked, and keeps only the answer about the latest file", async () => {
    const answers: ((answer: CsvCheck) => void)[] = [];
    backend.csvFiles.check = () => new Promise((resolve) => answers.push(resolve));
    await renderForm();
    await choose(csvFile("vana.csv"));

    expect(timesCheck()).toHaveTextContent("CSV-faili kontrollitakse (1.2)");
    expect(summary().getByText("vana.csv · kontrollimisel")).toBeInTheDocument();
    await choose(csvFile("uus.csv"));
    await act(async () => answers[1]({ ok: false, errors: [{ row: 2, message: "vigane kellaaeg" }] }));
    await act(async () => answers[0]({ ok: true, rows: 1, timeWindows: [] }));

    expect(summary().getByText("uus.csv · vigane, ei kasutata")).toBeInTheDocument();
    expect(screen.queryByText(/vana\.csv/)).not.toBeInTheDocument();
  });

  it("replaces an accepted file, and stops a check that does not answer with ×", async () => {
    await renderForm();
    await choose(csvFile("ajad.csv"));
    await choose(csvFile("ajad-viga.csv"));
    expect(summary().getByText("ajad-viga.csv · vigane, ei kasutata")).toBeInTheDocument();

    backend.csvFiles.check = () => new Promise(() => {});
    await choose(csvFile("aeglane.csv"));
    expect(timesCheck()).toHaveTextContent("CSV-faili kontrollitakse (1.2)");
    fireEvent.click(screen.getByRole("button", { name: "Eemalda aeglane.csv" }));
    expect(summary().getByText("puudub")).toBeInTheDocument();
  });

  it("removes a file when its check fails, and on ×", async () => {
    backend.csvFiles.check = () => Promise.reject(new Error("offline"));
    const { user } = await renderForm();
    await choose(csvFile());

    expect(toast.error).toHaveBeenCalledWith("Faili „ajad.csv“ ei õnnestunud kontrollida. Proovi uuesti.", { autoClose: false });
    expect(summary().getByText("puudub")).toBeInTheDocument();

    backend.csvFiles.check = createStubBackend().csvFiles.check;
    await choose(csvFile());
    await user.click(screen.getByRole("button", { name: "Eemalda ajad.csv" }));
    expect(summary().getByText("puudub")).toBeInTheDocument();
  });

  describe("a file dragged over the page", () => {
    const drag = (type: "dragEnter" | "drop", types: string[], files: File[] = []) =>
      fireEvent[type](window, { dataTransfer: { types, files } });

    it("shows a drop zone over the page and opens the CSV tab when dropped (frame 04b)", async () => {
      const check = vi.spyOn(backend.csvFiles, "check");
      await renderForm();
      drag("dragEnter", ["Files"]);
      expect(screen.getByText("Lase lahti, et laadida CSV-fail")).toBeInTheDocument();

      drag("drop", ["Files"], [csvFile()]);
      await act(async () => {});
      expect(screen.queryByText("Lase lahti, et laadida CSV-fail")).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Laadi CSV-fail" })).toHaveAttribute("aria-selected", "true");
      expect(check).toHaveBeenCalledOnce();
    });

    it("ignores a file while the form is not shown, but keeps the browser from opening it", async () => {
      const check = vi.spyOn(backend.csvFiles, "check");
      await renderForm({ active: false });
      drag("dragEnter", ["Files"]);

      expect(screen.queryByText("Lase lahti, et laadida CSV-fail")).not.toBeInTheDocument();
      expect(drag("drop", ["Files"], [csvFile()])).toBe(false); // the default action was prevented
      expect(check).not.toHaveBeenCalled();
    });

    it("ignores a file while an editor is open", async () => {
      const check = vi.spyOn(backend.csvFiles, "check");
      const { user } = await renderForm();
      await user.click(within(screen.getByRole("region", { name: "Ruumid" })).getByRole("button", { name: "+ Uus grupp" }));
      drag("dragEnter", ["Files"]);

      expect(screen.queryByText("Lase lahti, et laadida CSV-fail")).not.toBeInTheDocument();
      expect(drag("drop", ["Files"], [csvFile()])).toBe(false);
      expect(check).not.toHaveBeenCalled();
    });

    it("leaves a ranked row's drag alone", async () => {
      await renderForm();
      drag("dragEnter", ["text/plain"]);
      expect(screen.queryByText("Lase lahti, et laadida CSV-fail")).not.toBeInTheDocument();
    });
  });
});
