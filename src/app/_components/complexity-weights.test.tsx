import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, type ComplexityWeights } from "@/app/_lib/complexity";
import { ComplexityWeightsSection } from "./complexity-weights";

function Harness() {
  const [value, setValue] = useState<ComplexityWeights>(DEFAULT_WEIGHTS);
  return (
    <>
      <ComplexityWeightsSection value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const renderWeights = () => {
  render(<Harness />);
  return {
    user: userEvent.setup(),
    value: () => JSON.parse(screen.getByTestId("value").textContent ?? "") as ComplexityWeights,
  };
};
const typed = (name: string) => screen.getByRole("textbox", { name: `${name}: kaal numbrina` });

describe("ComplexityWeightsSection", () => {
  it("is collapsed and uses the defaults on a new search (US-005)", () => {
    renderWeights();

    expect(screen.getByText("Täpsemad seaded: keerukusklasside kaalud").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("vaikimisi")).toBeInTheDocument();
    expect(typed("Omanikule kirjutada")).toHaveValue("0,70");
  });

  it.each<[string, string, number]>([
    ["0,456", "0,46", 0.46],
    ["1,2", "1,00", 1],
    ["-0,1", "0,00", 0],
    ["0.25", "0,25", 0.25],
  ])("reads a typed %j as %j", async (text, shown, weight) => {
    const { user, value } = renderWeights();
    await user.clear(typed("Muu"));
    await user.type(typed("Muu"), `${text}{Enter}`);

    expect(typed("Muu")).toHaveValue(shown);
    expect(value().other).toBe(weight);
  });

  it("keeps the old weight when the typed text is not a number", async () => {
    const { user, value } = renderWeights();
    await user.clear(typed("Muu"));
    await user.type(typed("Muu"), "palju");
    await user.tab();

    expect(typed("Muu")).toHaveValue("0,30");
    expect(value().other).toBe(0.3);
  });

  it("follows the slider, marks the change and restores the defaults", async () => {
    const { user, value } = renderWeights();
    fireEvent.change(screen.getByRole("slider", { name: "Google Form" }), { target: { value: "0.5" } });

    expect(typed("Google Form")).toHaveValue("0,50");
    expect(screen.getByText("muudetud, kehtivad sellele otsingule")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Taasta vaikimisi" }));
    expect(value()).toEqual(DEFAULT_WEIGHTS);
    expect(screen.getByRole("button", { name: "Taasta vaikimisi" })).toBeDisabled();
  });
});
