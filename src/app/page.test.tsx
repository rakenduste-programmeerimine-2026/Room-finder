import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("is the new search with the event and the candidate times", async () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Uus otsing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Üritus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Kandidaatajad" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Kandidaatpäevad" })).toBeInTheDocument();
  });
});
