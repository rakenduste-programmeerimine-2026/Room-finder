import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendContext } from "@/app/_ports/backend";
import type { Backend, Room, RoomGroup } from "@/app/_ports/ports";
import { createStubBackend } from "@/app/_ports/stubs";
import { RoomGroupEditor } from "./room-group-editor";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

let backend: Backend;
let catalog: Room[];

beforeEach(async () => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  backend = createStubBackend();
  catalog = await backend.rooms.list();
});

function renderEditor({ group = null as RoomGroup | null, groups = [] as RoomGroup[], attendees = null as number | null } = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <BackendContext value={backend}>
      <RoomGroupEditor catalog={catalog} group={group} groups={groups} attendees={attendees} onSaved={onSaved}
        onCancel={onCancel} />
    </BackendContext>,
  );
  return { onSaved, onCancel, user: userEvent.setup() };
}

const results = () => within(screen.getByRole("list", { name: "Leitud ruumid" }));
const groupRooms = () =>
  within(screen.getByRole("list", { name: "Grupi ruumid" })).queryAllByRole("listitem").map((li) => li.textContent?.match(/DEMO-\d+/)?.[0]);

describe("RoomGroupEditor", () => {
  it("starts a new group with the focus on its heading and every room listed", () => {
    renderEditor();

    expect(screen.getByRole("heading", { level: 1, name: "Uus ruumigrupp" })).toHaveFocus();
    expect(results().getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Salvesta uue nimega" })).not.toBeInTheDocument();
  });

  it("finds rooms by a name variant and by filters", async () => {
    const { user } = renderEditor();
    await user.type(screen.getByLabelText("Otsi koodi või nime järgi"), "aula");
    expect(results().getAllByRole("listitem").map((li) => li.textContent?.slice(0, 8))).toEqual(["DEMO-301"]);

    await user.clear(screen.getByLabelText("Otsi koodi või nime järgi"));
    await user.type(screen.getByLabelText("Mahutavus vähemalt"), "60");
    await user.click(screen.getByLabelText("Ainult õppetööks broneeritavad"));
    expect(results().getAllByRole("listitem")).toHaveLength(1); // DEMO-201: 120 places, teaching
    expect(screen.getByRole("status")).toHaveTextContent("Leitud ruume: 1");

    await user.selectOptions(screen.getByLabelText("Keerukusklass"), "Google Form");
    expect(results().queryAllByRole("listitem")).toHaveLength(0);
  });

  it("adds rooms in the order they are picked and ranks them", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-301 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-101 gruppi" }));

    expect(results().getAllByText("Grupis")).toHaveLength(2);
    expect(screen.getByText("2 ruumi · max 200")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "DEMO-301: eemalda grupist" }));
    expect(screen.getByText("1 ruum · max 200")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-301 gruppi" }));

    await user.click(screen.getByRole("button", { name: "DEMO-301: liiguta üles" }));
    expect(groupRooms()).toEqual(["DEMO-301", "DEMO-101"]);
  });

  it("saves a new group with a trimmed name and hands it back", async () => {
    const { user, onSaved } = renderEditor();
    await user.type(screen.getByLabelText("Grupi nimi"), "  Nõukogu ruumid ");
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-103 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "Nõukogu ruumid", roomCodes: ["DEMO-103"] }));
    expect(toast.success).toHaveBeenCalledWith("Grupp salvestatud: „Nõukogu ruumid“ on nüüd valikus.");
    expect(await backend.roomGroups.list()).toHaveLength(1);
  });

  it("stays open with an error toast and inline messages when the name or the rooms are missing", async () => {
    const { user, onSaved } = renderEditor();
    expect(screen.getByLabelText("Grupi nimi")).toHaveAttribute("aria-invalid", "false");

    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Gruppi ei salvestatud: Anna grupile nimi. Lisa gruppi vähemalt üks ruum.");
    expect(screen.getByLabelText("Grupi nimi")).toHaveAccessibleDescription("Anna grupile nimi.");
    expect(screen.getByText("Lisa gruppi vähemalt üks ruum.")).toBeInTheDocument();
  });

  it("marks a name the user already has before saving, and a name over 100 characters", async () => {
    const { user } = renderEditor({ groups: [{ id: "1", name: "Aulad", roomCodes: ["DEMO-301"] }] });
    await user.type(screen.getByLabelText("Grupi nimi"), "Aulad");
    expect(screen.getByLabelText("Grupi nimi")).toHaveAccessibleDescription("Sul on juba sellise nimega ruumigrupp.");

    await user.clear(screen.getByLabelText("Grupi nimi"));
    await user.click(screen.getByLabelText("Grupi nimi"));
    await user.paste("a".repeat(101));
    expect(screen.getByLabelText("Grupi nimi")).toHaveAccessibleDescription("Nimi võib olla kuni 100 märki.");
  });

  it("shows the name-taken toast when the backend refuses the name, and keeps the changes", async () => {
    await backend.roomGroups.create("Aulad", ["DEMO-301"]); // saved in another tab, not yet in the list
    const { user, onSaved } = renderEditor();
    await user.type(screen.getByLabelText("Grupi nimi"), "Aulad");
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-101 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Nimi on juba kasutusel: sul on juba grupp nimega „Aulad“. Vali teine nimi.");
    expect(groupRooms()).toEqual(["DEMO-101"]);
  });

  it("keeps the changes when saving fails", async () => {
    backend = { ...backend, roomGroups: { ...backend.roomGroups, create: () => Promise.reject(new Error("offline")) } };
    const { user, onSaved } = renderEditor();
    await user.type(screen.getByLabelText("Grupi nimi"), "Aulad");
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-101 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Gruppi ei õnnestunud salvestada. Sinu muudatused on alles, proovi uuesti.");
    expect(screen.getByLabelText("Grupi nimi")).toHaveValue("Aulad");
    expect(screen.getByRole("button", { name: "Salvesta grupp" })).toBeEnabled();
  });

  describe("an existing group", () => {
    async function existing() {
      const saved = await backend.roomGroups.create("Aulad", ["DEMO-301", "DEMO-101"]);
      if (!saved.ok) throw new Error();
      return saved.group;
    }

    it("saves the changes under the same id, keeping its own name", async () => {
      const group = await existing();
      const { user, onSaved } = renderEditor({ group, groups: [group] });
      expect(groupRooms()).toEqual(["DEMO-301", "DEMO-101"]);
      await user.click(screen.getByRole("button", { name: "DEMO-101: liiguta üles" }));
      await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

      expect(onSaved).toHaveBeenCalledWith({ id: group.id, name: "Aulad", roomCodes: ["DEMO-101", "DEMO-301"] });
    });

    it("saves a copy under a new name, but not under the same name", async () => {
      const group = await existing();
      const { user, onSaved } = renderEditor({ group, groups: [group] });
      await user.click(screen.getByRole("button", { name: "Salvesta uue nimega" }));
      expect(toast.error).toHaveBeenCalledWith("Nimi on juba kasutusel: sul on juba grupp nimega „Aulad“. Vali teine nimi.");

      await user.clear(screen.getByLabelText("Grupi nimi"));
      await user.type(screen.getByLabelText("Grupi nimi"), "Aulad 2");
      await user.click(screen.getByRole("button", { name: "Salvesta uue nimega" }));

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "Aulad 2" }));
      expect((await backend.roomGroups.list()).map((g) => g.name).sort()).toEqual(["Aulad", "Aulad 2"]);
    });

    it("cancels without saving", async () => {
      const group = await existing();
      const { user, onCancel } = renderEditor({ group, groups: [group] });
      await user.click(screen.getByRole("button", { name: "DEMO-101: eemalda grupist" }));
      await user.click(screen.getByRole("button", { name: "Tühista" }));

      expect(onCancel).toHaveBeenCalled();
      expect((await backend.roomGroups.list())[0].roomCodes).toEqual(["DEMO-301", "DEMO-101"]);
    });
  });

  it.each<[number, boolean]>([[199, true], [200, false]])("with %i rooms, adding is allowed: %s", (n, allowed) => {
    const codes = Array.from({ length: n }, (_, i) => `X-${i}`);
    renderEditor({ group: { id: "1", name: "Suur", roomCodes: codes }, groups: [] });
    const add = screen.getByRole("button", { name: "Lisa DEMO-101 gruppi" });

    if (allowed) expect(add).toBeEnabled();
    else expect(add).toBeDisabled();
  });

  it.each<[string, number, boolean]>([
    ["", 10, false],
    ["0", 10, false],
    ["121", 1, false],
    ["kakskümmend", 10, true],
  ])("with capacity %j lists %i rooms (invalid: %s)", async (text, rooms, invalid) => {
    const { user } = renderEditor();
    if (text) await user.type(screen.getByLabelText("Mahutavus vähemalt"), text);

    expect(results().queryAllByRole("listitem")).toHaveLength(rooms);
    expect(screen.getByLabelText("Mahutavus vähemalt")).toHaveAttribute("aria-invalid", String(invalid));
    if (invalid) {
      expect(screen.getByLabelText("Mahutavus vähemalt")).toHaveAccessibleDescription(
        "Sisesta täisarv. Seni näidatakse kõiki ruume.",
      );
    }
  });

  it("refuses to save a name over 100 characters with an error toast", async () => {
    const { user, onSaved } = renderEditor();
    await user.click(screen.getByLabelText("Grupi nimi"));
    await user.paste("a".repeat(101));
    await user.click(screen.getByRole("button", { name: "Lisa DEMO-101 gruppi" }));
    await user.click(screen.getByRole("button", { name: "Salvesta grupp" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Gruppi ei salvestatud: Nimi võib olla kuni 100 märki.");
  });

  it("marks rooms too small for the attendees", () => {
    renderEditor({ attendees: 10 });
    expect(results().getByText("8 kohta · liiga väike")).toBeInTheDocument();
  });
});
