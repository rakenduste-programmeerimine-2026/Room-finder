import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchForm } from "./search-form";

describe("SearchForm", () => {
  it("checks the candidate ranges against the chosen duration", async () => {
    render(<SearchForm />);
    await act(async () => {}); // let the semester start arrive
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Päev 1: kuupäev"), { target: { value: "2026-12-01" } });
    const range = screen.getByLabelText("Päev 1, vahemik 1: algus"); // 10:00–12:00

    await user.selectOptions(screen.getByLabelText("Kestus"), "2 h");
    expect(range).toHaveAttribute("aria-invalid", "false");

    await user.selectOptions(screen.getByLabelText("Kestus"), "2 h 30 min");
    expect(range).toHaveAttribute("aria-invalid", "true");
    expect(range).toHaveAccessibleDescription("Vahemik on lühem kui ürituse kestus (2 h 30 min).");
  });
});
