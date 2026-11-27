import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimeWindows } from "@/app/_lib/time/time-windows";
import { BackendContext } from "@/app/_ports/backend";
import type { Backend } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { TimeWindowTool } from "./time-window-tool";

vi.mock("react-toastify", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const SPRING_2027 = "2027-01-31T22:00:00Z"; // 1 February 2027, 00:00 in Tallinn

async function renderTool({ duration = 60, nextStart = () => Promise.resolve(SPRING_2027) } = {}) {
  const onChange = vi.fn<(windows: TimeWindows | null) => void>();
  const backend: Backend = { ...createStubBackend(), semester: { nextStart } };
  render(
    <BackendContext value={backend}>
      <TimeWindowTool durationMinutes={duration} onChange={onChange} />
    </BackendContext>,
  );
  await act(async () => {}); // let the semester start arrive
  const last = () => onChange.mock.calls.at(-1)?.[0];
  return { onChange, last, user: userEvent.setup() };
}

const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.mocked(toast.warning).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("TimeWindowTool", () => {
  it("starts with one day and one range 10:00–12:00, asking for a date", async () => {
    const { last } = await renderTool();

    expect(screen.getByLabelText("Päev 1: kuupäev")).toHaveValue("");
    expect(screen.getByLabelText("Päev 1, vahemik 1: algus")).toHaveValue("10:00");
    expect(screen.getByLabelText("Päev 1, vahemik 1: lõpp")).toHaveValue("12:00");
    expect(screen.getByText("Vali kuupäev.")).toBeInTheDocument();
    expect(last()).toBeNull();
  });

  it("sends the local times in UTC", async () => {
    const { last } = await renderTool();
    change("Päev 1: kuupäev", "2026-12-01");

    expect(screen.getByText("Teisipäev, 1. detsember 2026")).toBeInTheDocument();
    expect(last()?.[0].days[0].ranges).toEqual([{ start: "2026-12-01T08:00:00Z", end: "2026-12-01T10:00:00Z" }]);
  });

  it("ranks days by moving them, and sends them in that order", async () => {
    const { last, user } = await renderTool();
    change("Päev 1: kuupäev", "2026-12-01");
    await user.click(screen.getByRole("button", { name: "+ Lisa päev" }));
    change("Päev 2: kuupäev", "2026-12-02");

    expect(screen.getByRole("button", { name: "Päev 1: liiguta üles" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Päev 2: liiguta üles" }));

    expect(screen.getByLabelText("Päev 1: kuupäev")).toHaveValue("2026-12-02");
    expect(last()?.[0].days.map((d) => d.start)).toEqual(["2026-12-01T22:00:00Z", "2026-11-30T22:00:00Z"]);
    expect(screen.getByText("Päev 2 on nüüd 1. kohal.")).toBeInTheDocument();
  });

  it("ranks ranges within a day", async () => {
    const { last, user } = await renderTool();
    change("Päev 1: kuupäev", "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Päev 1: lisa vahemik" }));
    change("Päev 1, vahemik 2: algus", "14:00");
    change("Päev 1, vahemik 2: lõpp", "16:00");
    await user.click(screen.getByRole("button", { name: "Päev 1, vahemik 2: liiguta üles" }));

    expect(last()?.[0].days[0].ranges.map((r) => r.start)).toEqual(["2026-12-01T12:00:00Z", "2026-12-01T08:00:00Z"]);
  });

  it("removes a range and a day, but never the last one", async () => {
    const { user } = await renderTool();
    expect(screen.getByRole("button", { name: "Päev 1: eemalda" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Päev 1, vahemik 1: eemalda" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Päev 1: lisa vahemik" }));
    expect(screen.getByText("Päev 1: vahemik lisati.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Päev 1, vahemik 1: eemalda" }));
    expect(within(screen.getByRole("list", { name: "Päev 1: vahemikud" })).getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "+ Lisa päev" }));
    await user.click(screen.getByRole("button", { name: "Päev 1: eemalda" }));
    expect(within(screen.getByRole("list", { name: "Kandidaatpäevad" })).getAllByLabelText(/: kuupäev$/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Päev 1: eemalda" })).toBeDisabled();
  });

  describe("validation", () => {
    it("marks a range that ends before it starts", async () => {
      const { last } = await renderTool();
      change("Päev 1: kuupäev", "2026-12-01");
      change("Päev 1, vahemik 1: lõpp", "09:00");

      expect(screen.getByLabelText("Päev 1, vahemik 1: lõpp")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Päev 1, vahemik 1: lõpp")).toHaveAccessibleDescription("Lõpp peab olema pärast algust.");
      expect(last()).toBeNull();
    });

    it("reads an end of 00:00 as midnight, but 00:00–00:00 as invalid", async () => {
      const { last } = await renderTool();
      change("Päev 1: kuupäev", "2026-12-01");
      change("Päev 1, vahemik 1: algus", "23:00");
      change("Päev 1, vahemik 1: lõpp", "00:00");
      expect(last()?.[0].days[0].ranges[0]).toEqual({ start: "2026-12-01T21:00:00Z", end: "2026-12-01T22:00:00Z" });

      change("Päev 1, vahemik 1: algus", "00:00");
      expect(screen.getByText("Lõpp peab olema pärast algust.")).toBeInTheDocument();
      expect(last()).toBeNull();
    });

    it("marks a range shorter than the event", async () => {
      await renderTool({ duration: 90 });
      change("Päev 1: kuupäev", "2026-12-01");
      change("Päev 1, vahemik 1: lõpp", "11:29");

      expect(screen.getByText("Vahemik on lühem kui ürituse kestus (1 h 30 min).")).toBeInTheDocument();
    });

    it("marks a time skipped by the spring change", async () => {
      await renderTool();
      change("Päev 1: kuupäev", "2026-03-29");
      change("Päev 1, vahemik 1: algus", "03:30");
      change("Päev 1, vahemik 1: lõpp", "06:00");

      expect(screen.getByText("Seda kellaaega sel päeval ei ole (kellakeeramine).")).toBeInTheDocument();
    });

    it("accepts the repeated autumn hour as the earlier instant", async () => {
      const { last } = await renderTool();
      change("Päev 1: kuupäev", "2026-10-25");
      change("Päev 1, vahemik 1: algus", "03:30");
      change("Päev 1, vahemik 1: lõpp", "05:00");

      expect(last()?.[0].days[0].ranges[0]).toEqual({ start: "2026-10-25T00:30:00Z", end: "2026-10-25T03:00:00Z" });
    });

    it("marks a date added twice", async () => {
      const { user } = await renderTool();
      change("Päev 1: kuupäev", "2026-12-01");
      await user.click(screen.getByRole("button", { name: "+ Lisa päev" }));
      change("Päev 2: kuupäev", "2026-12-01");

      expect(screen.getByText("See päev on juba lisatud.")).toBeInTheDocument();
    });
  });

  describe("next semester", () => {
    it("does not warn for the day before it starts", async () => {
      await renderTool();
      change("Päev 1: kuupäev", "2027-01-31");

      expect(screen.queryByText("Valitud päevad on järgmisel poolaastal")).not.toBeInTheDocument();
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it("warns with a toast and a banner from its first day, once per new date", async () => {
      await renderTool();
      change("Päev 1: kuupäev", "2027-02-01");

      expect(screen.getByText("Valitud päevad on järgmisel poolaastal")).toBeInTheDocument();
      expect(screen.getByText(/Poolaasta algus: 1\. veebruar 2027\./)).toBeInTheDocument();
      expect(toast.warning).toHaveBeenCalledTimes(1);

      change("Päev 1, vahemik 1: lõpp", "13:00"); // same dates, no new toast
      expect(toast.warning).toHaveBeenCalledTimes(1);
    });

    it("warns again when another next-semester date is added", async () => {
      const { user } = await renderTool();
      change("Päev 1: kuupäev", "2027-02-01");
      await user.click(screen.getByRole("button", { name: "+ Lisa päev" }));
      change("Päev 2: kuupäev", "2027-02-02");

      expect(toast.warning).toHaveBeenCalledTimes(2);
    });

    it("shows an error toast when the semester start cannot be loaded", async () => {
      await renderTool({ nextStart: () => Promise.reject(new Error("offline")) });

      expect(toast.error).toHaveBeenCalledWith("Järgmise poolaasta algust ei õnnestunud laadida.", { autoClose: false });
    });
  });
});
