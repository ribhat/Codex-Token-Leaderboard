import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("HomePage", () => {
  it("renders the dashboard title", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Token Leaderboard" })).toBeInTheDocument();
  });
});
