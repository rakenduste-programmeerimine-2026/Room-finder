import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/app/_ports/ports";
import { RankedRoomList } from "./room-list";

const room = (code: string, capacity: number, change: Partial<Room> = {}): Room => ({
  code,
  capacity,
  bookableForTeaching: false,
  aliases: [`${code} nimi`],
  complexity: "google_form",
  eventTypes: [],
  ...change,
});
const CATALOG = new Map(
  [room("DEMO-101", 30, { bookableForTeaching: true }), room("DEMO-103", 8), room("DEMO-301", 200), room("DEMO-1", 1)].map(
    (r) => [r.code, r],
  ),
);

function renderList(codes = ["DEMO-101", "DEMO-103", "DEMO-301"], attendees: number | null = null, removable = false) {
  const onMove = vi.fn();
  const onRemove = vi.fn();
  render(
    <RankedRoomList label="Ruumid" codes={codes} catalog={CATALOG} attendees={attendees} onMove={onMove}
      onRemove={removable ? onRemove : undefined} />,
  );
  const rows = () => within(screen.getByRole("list", { name: "Ruumid" })).getAllByRole("listitem");
  return { onMove, onRemove, rows, user: userEvent.setup() };
}

describe("RankedRoomList", () => {
  it("shows each room with its rank, name variants, capacity, teaching use and complexity class", () => {
    const { rows } = renderList();

    expect(rows()[0]).toHaveTextContent("1.DEMO-101DEMO-101 nimi30 kohtaÕppetööGoogle Form");
    expect(rows()[1]).not.toHaveTextContent("Õppetöö");
  });

  it("marks a room smaller than the attendee count, but not one exactly as big", () => {
    const { rows } = renderList(undefined, 30);

    expect(rows()[0]).toHaveTextContent("30 kohta");
    expect(rows()[0]).not.toHaveTextContent("liiga väike");
    expect(rows()[1]).toHaveTextContent("8 kohta · liiga väike");
  });

  it("writes one place in the singular", () => {
    const { rows } = renderList(["DEMO-1"]);
    expect(rows()[0]).toHaveTextContent("1 koht");
  });

  it("says when a code is not in the catalogue", () => {
    const { rows } = renderList(["DEMO-999"]);
    expect(rows()[0]).toHaveTextContent("Ruumi ei leitud kataloogist");
  });

  it("moves a room with the arrows and announces its new rank", async () => {
    const { onMove, user } = renderList();

    expect(screen.getByRole("button", { name: "DEMO-101: liiguta üles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "DEMO-301: liiguta alla" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "DEMO-103: liiguta üles" }));

    expect(onMove).toHaveBeenCalledWith(1, 0);
    expect(screen.getByText("DEMO-103 on nüüd 1. kohal.")).toBeInTheDocument();
  });

  it("moves a room dragged onto another row", () => {
    const { onMove, rows } = renderList();

    fireEvent.dragStart(rows()[2]);
    fireEvent.dragOver(rows()[0]);
    fireEvent.drop(rows()[0]);

    expect(onMove).toHaveBeenCalledWith(2, 0);
    expect(screen.getByText("DEMO-301 on nüüd 1. kohal.")).toBeInTheDocument();
  });

  it("ignores a drop on the same row and a drop without a drag", () => {
    const { onMove, rows } = renderList();

    fireEvent.dragStart(rows()[1]);
    fireEvent.drop(rows()[1]);
    fireEvent.drop(rows()[0]);

    expect(onMove).not.toHaveBeenCalled();
  });

  it("offers removing only when allowed", async () => {
    renderList();
    expect(screen.queryByRole("button", { name: /eemalda grupist/ })).not.toBeInTheDocument();
  });

  it("removes a room", async () => {
    const { onRemove, user } = renderList(undefined, null, true);
    await user.click(screen.getByRole("button", { name: "DEMO-103: eemalda grupist" }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
