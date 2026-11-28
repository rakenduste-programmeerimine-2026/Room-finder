import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { curriculumOf } from "@/app/_lib/curricula";
import { BackendContext } from "@/app/_ports/backend";
import type { Backend } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { SearchJourney } from "./search-journey";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

let backend: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(toast.error).mockClear();
  backend = createStubBackend();
  await backend.roomGroups.create("Aulad", ["DEMO-301", "DEMO-101"]);
});
afterEach(() => vi.useRealTimers());

const later = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function renderJourney() {
  render(
    <BackendContext value={backend}>
      <SearchJourney />
    </BackendContext>,
  );
  await later(0); // let the backend answer
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Fills the required parts: event type, room group and one day with the default range 10:00–12:00. */
async function fill(user: ReturnType<typeof userEvent.setup>, attendees = "") {
  await user.type(screen.getByLabelText("Ürituse tüüp"), "Koosolek");
  if (attendees) await user.type(screen.getByLabelText("Osalejaid (valikuline)"), attendees);
  await user.selectOptions(screen.getByLabelText("Salvestatud ruumigrupp"), "Aulad · 2 ruumi");
  fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });
}

const search = () => screen.getByRole("button", { name: "Leia aeg ja ruum" });
const step = () => screen.getByRole("status").textContent;

describe("SearchJourney", () => {
  it("sends the search, shows the loading screen and then the best time and room", async () => {
    const user = await renderJourney();
    await fill(user);
    await user.click(search());

    expect(screen.getByRole("heading", { level: 1, name: "Otsin parimat aega ja ruumi…" })).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Uus otsing" })).not.toBeInTheDocument();
    expect(step()).toBe("Ootan järjekorras");

    await later(2000);
    expect(step()).toBe("Kogun ASIOst andmeid (2 ruumi) ja arvutan parima aja ja ruumi");

    await later(2000);
    expect(screen.getByRole("heading", { level: 1, name: "Parim aeg ja ruum" })).toHaveFocus();
    const best = screen.getByRole("region", { name: "Parim aeg ja ruum" });
    expect(best).toHaveTextContent("Teisipäev, 1. detsember 2026");
    expect(best).toHaveTextContent("10:00 – 11:30");
    expect(best).toHaveTextContent("DEMO-301 · Demo aula · Demo konverentsisaal");
  });

  it("counts the curricula while waiting and lists them in the result", async () => {
    const [informaatika, , , , , infoteadus] = await backend.curricula.list();
    await backend.curriculumGroups.create("Digi", [curriculumOf(informaatika), curriculumOf(infoteadus)]);
    const user = await renderJourney();
    await fill(user);
    await user.selectOptions(screen.getByLabelText("Salvestatud õppekavade grupp"), "Digi · 2 õppekava");
    await user.click(search());
    await later(2000);
    expect(step()).toBe("Kogun ASIOst andmeid (2 ruumi, 2 õppekava) ja arvutan parima aja ja ruumi");

    await later(2000);
    const rows = within(screen.getByRole("region", { name: "Kellele see aeg ei sobi" })).getAllByRole("listitem");
    expect(rows.map((li) => li.textContent)).toEqual([
      "1. Demo informaatika 1. õ.-a. (DEMOINF-1) – sobib",
      "2. Demo infoteadus 1. õ.-a.DEMOITB-1Kattub: 10:15 – 11:45",
    ]);
  });

  it("goes back to the same inputs with \"Muuda sisendeid\" and to an empty form with \"Uus otsing\"", async () => {
    const user = await renderJourney();
    await fill(user, "12");
    await user.click(search());
    await later(4000);

    await user.click(screen.getAllByRole("button", { name: "Muuda sisendeid" })[0]);
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toHaveFocus();
    expect(screen.getByLabelText("Ürituse tüüp")).toHaveValue("Koosolek");
    expect(screen.getByLabelText("Osalejaid (valikuline)")).toHaveValue("12");
    expect(screen.getByLabelText("Päev 1: kuupäev")).toHaveValue("2026-12-01");

    await user.click(search());
    await later(4000);
    await user.click(screen.getByRole("button", { name: "Uus otsing" }));
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toHaveFocus();
    expect(screen.getByLabelText("Ürituse tüüp")).toHaveValue("");
    expect(search()).toBeDisabled();
  });

  it("says when no time and room fit", async () => {
    const user = await renderJourney();
    await fill(user, "10000"); // no DEMO room holds 10 000 people
    await user.click(search());
    await later(4000);

    expect(screen.getByRole("heading", { level: 1, name: "Sobivat aega ja ruumi ei leitud" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Muuda sisendeid" }));
    expect(screen.getByLabelText("Osalejaid (valikuline)")).toHaveValue("10000");
  });

  it("shows the first step while the search is sent, and can stop then too", async () => {
    let created: (id: string) => void = () => {};
    backend.searches.start = () => new Promise((resolve) => (created = resolve));
    const user = await renderJourney();
    await fill(user);
    await user.click(search());

    expect(step()).toBe("Salvestan otsingu");
    await user.click(screen.getByRole("button", { name: "Katkesta ootamine" }));
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toHaveFocus();

    await act(async () => created("late"));
    await later(10_000);
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toBeInTheDocument();
  });

  it("sends one search when the button is pressed twice", async () => {
    const start = vi.spyOn(backend.searches, "start");
    const user = await renderJourney();
    await fill(user);
    const button = search();
    fireEvent.click(button);
    fireEvent.click(button); // the form is hidden by now, but the event still arrives

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("returns to the form with an error toast when the search cannot be started", async () => {
    backend.searches.start = () => Promise.reject(new Error("offline"));
    const user = await renderJourney();
    await fill(user);
    await user.click(search());

    expect(toast.error).toHaveBeenCalledWith("Otsingut ei õnnestunud alustada. Sinu sisendid on alles, proovi uuesti.", {
      autoClose: false,
    });
    expect(screen.getByLabelText("Ürituse tüüp")).toHaveValue("Koosolek");
  });

  it("returns to the form with an error toast when the search fails", async () => {
    backend.searches.status = async () => ({ status: "failed", error: "ASIO did not answer" });
    const user = await renderJourney();
    await fill(user);
    await user.click(search());
    await later(2000);

    expect(toast.error).toHaveBeenCalledWith("Otsing ebaõnnestus. Sinu sisendid on alles, proovi mõne minuti pärast uuesti.", {
      autoClose: false,
    });
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toHaveFocus();
  });

  it("keeps asking after a failed check and gives up after 2 minutes", async () => {
    const status = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ status: "running" });
    backend.searches.status = status;
    const user = await renderJourney();
    await fill(user);
    await user.click(search());

    await later(119_000);
    expect(status.mock.calls.length).toBeGreaterThanOrEqual(58); // every 2 s, also after the failed check
    expect(screen.getByRole("heading", { level: 1, name: "Otsin parimat aega ja ruumi…" })).toBeInTheDocument();

    await later(1_000);
    expect(toast.error).toHaveBeenCalledWith("Vastust ei tulnud 2 minuti jooksul. Sinu sisendid on alles, proovi uuesti.", {
      autoClose: false,
    });
    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toBeInTheDocument();
    const checks = status.mock.calls.length;
    await later(10_000);
    expect(status).toHaveBeenCalledTimes(checks);
  });

  it("stops waiting on \"Katkesta ootamine\" and ignores the answer that comes later", async () => {
    const user = await renderJourney();
    await fill(user);
    await user.click(search());
    await user.click(screen.getByRole("button", { name: "Katkesta ootamine" }));

    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toHaveFocus();
    await later(10_000);
    expect(screen.queryByRole("heading", { name: "Parim aeg ja ruum" })).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
