import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("HomePage", () => {
  it("renders the scaffold title", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Codex Token Leaderboard" })).toBeInTheDocument();
  });
});
