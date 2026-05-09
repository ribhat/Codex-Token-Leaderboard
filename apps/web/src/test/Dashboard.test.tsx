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

    render(<Dashboard accessToken="dashboard-token" />);

    await user.click(screen.getByRole("button", { name: "Generate token" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/collector/devices",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer dashboard-token" }),
        body: expect.stringContaining("\"platform\":\"web\"")
      })
    );
    expect(
      await screen.findByText((text) => text.includes("codex-tokens login --server") && text.includes("device-token"))
    ).toBeInTheDocument();
  });

  it("does not call the collector token route before sign-in", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard />);

    const button = screen.getByRole("button", { name: "Generate token" });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to generate a collector token.")).toBeInTheDocument();
  });

  it("shows hidden totals and stale sync status in member rows", () => {
    render(<Dashboard />);

    const privateRow = screen.getByRole("row", { name: /sam privacy/i });
    expect(within(privateRow).getByText("Hidden")).toBeInTheDocument();

    const staleRow = screen.getByRole("row", { name: /morgan stale/i });
    expect(within(staleRow).getByText("Sync stale")).toBeInTheDocument();
  });
});
