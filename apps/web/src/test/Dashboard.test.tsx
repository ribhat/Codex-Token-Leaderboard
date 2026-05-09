import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../components/Dashboard";

describe("Dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the functional dashboard controls", () => {
    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Token Leaderboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create group" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Time" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate token" })).toBeInTheDocument();
  });

  it("marks the selected leaderboard range", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: "Month" }));

    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "false");
  });

  it("generates a collector login command with the returned token", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "device-token" })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard />);

    await user.click(screen.getByRole("button", { name: "Generate token" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/collector/devices",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"platform\":\"web\"")
      })
    );
    expect(
      await screen.findByText((text) => text.includes("codex-tokens login --server") && text.includes("device-token"))
    ).toBeInTheDocument();
  });

  it("shows hidden totals and stale sync status in member rows", () => {
    render(<Dashboard />);

    const privateRow = screen.getByRole("row", { name: /sam privacy/i });
    expect(within(privateRow).getByText("Hidden")).toBeInTheDocument();

    const staleRow = screen.getByRole("row", { name: /morgan stale/i });
    expect(within(staleRow).getByText("Sync stale")).toBeInTheDocument();
  });
});
