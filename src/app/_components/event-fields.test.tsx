import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { EMPTY_EVENT, type EventDraft } from "@/app/_lib/event";
import { EventFields } from "./event-fields";

function Harness() {
  const [value, setValue] = useState<EventDraft>(EMPTY_EVENT);
  return (
    <>
      <EventFields value={value} onChange={setValue} eventTypes={["koosolek", "seminar"]} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const renderFields = () => {
  render(<Harness />);
  return { user: userEvent.setup(), value: () => JSON.parse(screen.getByTestId("value").textContent ?? "") as EventDraft };
};
const name = () => screen.getByLabelText("Ürituse nimi (valikuline)");
const duration = () => screen.getByLabelText("Kestus");
const attendees = () => screen.getByLabelText("Osalejaid (valikuline)");

describe("EventFields", () => {
  it("starts empty with 1 h 30 min, and explains the optional attendee count", () => {
    renderFields();

    expect(name()).toHaveValue("");
    expect(duration()).toHaveDisplayValue("1 h 30 min");
    expect(attendees()).toHaveValue("");
    expect(attendees()).toHaveAccessibleDescription("Ruumi mahutavus peab olema vähemalt nii suur.");
    expect(duration()).toHaveAccessibleDescription("Iga kandidaatvahemik peab mahutama terve ürituse.");
  });

  it("offers durations from 5 minutes to 12 hours", async () => {
    const { user, value } = renderFields();
    const options = within(duration()).getAllByRole("option");

    expect(options[0]).toHaveTextContent("5 min");
    expect(options.at(-1)).toHaveTextContent("12 h");
    await user.selectOptions(duration(), "12 h");
    expect(value().durationMinutes).toBe(720);
  });

  it("accepts a 100-character name and marks a 101-character one", () => {
    renderFields();
    fireEvent.change(name(), { target: { value: "a".repeat(100) } });
    expect(name()).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(name(), { target: { value: "a".repeat(101) } });
    expect(name()).toHaveAttribute("aria-invalid", "true");
    expect(name()).toHaveAccessibleDescription("Nimi võib olla kuni 100 märki.");
  });

  it.each(["1", "10000", " 12 "])("accepts %j attendees", (count) => {
    renderFields();
    fireEvent.change(attendees(), { target: { value: count } });

    expect(attendees()).toHaveAttribute("aria-invalid", "false");
  });

  it.each(["0", "10001", "1.5", "kaksteist"])("marks %j attendees", (count) => {
    renderFields();
    fireEvent.change(attendees(), { target: { value: count } });

    expect(attendees()).toHaveAttribute("aria-invalid", "true");
    expect(attendees()).toHaveAccessibleDescription(/^Sisesta täisarv 1 kuni 10\s000\.$/);
  });

  it("asks for an event type without marking the empty field as an error", () => {
    renderFields();
    const type = screen.getByLabelText("Ürituse tüüp");

    expect(type).toHaveAttribute("aria-required", "true");
    expect(type).toHaveAttribute("aria-invalid", "false");
    expect(type).toHaveAccessibleDescription(/^Vali soovitustest, populaarsemad eespool, või kirjuta uus tüüp\./);
  });

  it("accepts a new 60-character event type and marks a 61-character one", () => {
    renderFields();
    const type = screen.getByLabelText("Ürituse tüüp");
    fireEvent.change(type, { target: { value: "x".repeat(60) } });
    expect(type).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(type, { target: { value: "x".repeat(61) } });
    expect(type).toHaveAttribute("aria-invalid", "true");
    expect(type).toHaveAccessibleDescription("Tüüp võib olla kuni 60 märki.");
  });

  it("keeps the text as typed", async () => {
    const { user, value } = renderFields();
    await user.type(name(), " Koosolek ");
    await user.type(screen.getByLabelText("Ürituse tüüp"), "Mälumäng");
    await user.type(attendees(), "12");

    expect(value()).toEqual({ name: " Koosolek ", eventType: "Mälumäng", durationMinutes: 90, attendees: "12" });
  });
});
