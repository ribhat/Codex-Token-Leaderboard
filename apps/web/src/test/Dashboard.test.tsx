import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/lib/supabaseBrowser", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabaseBrowser")>("@/lib/supabaseBrowser");
  return {
    ...actual,
    createSupabaseBrowserClient: vi.fn(() => ({
      auth: authMocks
    }))
  };
});

import { Dashboard } from "../components/Dashboard";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("Dashboard", () => {
  beforeEach(() => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    authMocks.signInWithOAuth.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  it("creates a group through the dashboard API and loads its leaderboard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/groups") {
        return jsonResponse({
          group: {
            id: "group-1",
            name: "Builders",
            creatorId: "user-1",
            timezone: "UTC",
            createdAt: "2026-05-08T12:00:00.000Z"
          },
          inviteCode: "invite-code"
        });
      }
      if (url === "/api/groups/group-1/leaderboard?range=today") {
        return jsonResponse({ rows: [] });
      }
      throw new Error(`Unexpected fetch ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard accessToken="dashboard-token" />);

    await user.type(screen.getByLabelText("Group name"), "Builders");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(await screen.findByText("Created Builders. Invite code: invite-code")).toBeInTheDocument();
    expect(screen.getByText("Current group: Builders")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/groups",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer dashboard-token" }),
        body: JSON.stringify({ name: "Builders" })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/groups/group-1/leaderboard?range=today",
      expect.objectContaining({ headers: { Authorization: "Bearer dashboard-token" } })
    );
  });

  it("joins a group by invite code through the dashboard API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/groups/join") {
        return jsonResponse({
          group: {
            id: "group-2",
            name: "Friends",
            creatorId: "user-2",
            timezone: "UTC",
            createdAt: "2026-05-08T12:00:00.000Z"
          }
        });
      }
      if (url === "/api/groups/group-2/leaderboard?range=today") {
        return jsonResponse({ rows: [] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard accessToken="dashboard-token" />);

    await user.type(screen.getByLabelText("Invite code"), "invite-code");
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Joined Friends.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/groups/join",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer dashboard-token" }),
        body: JSON.stringify({ inviteCode: "invite-code" })
      })
    );
  });

  it("clears loaded group and leaderboard state on sign-out", async () => {
    const user = userEvent.setup();
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "session-token",
          user: { id: "user-1", email: "ada@example.test", user_metadata: { name: "Ada" } }
        }
      }
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/groups") {
        return jsonResponse({
          group: {
            id: "group-1",
            name: "Builders",
            creatorId: "user-1",
            timezone: "UTC",
            createdAt: "2026-05-08T12:00:00.000Z"
          },
          inviteCode: "invite-code"
        });
      }
      if (url === "/api/groups/group-1/leaderboard?range=today") {
        return jsonResponse({ rows: [] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard />);

    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Group name"), "Builders");
    await user.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByText("Current group: Builders")).toBeInTheDocument();
    expect(await screen.findByText("No synced members yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(screen.getByText("Sample group: 3 members")).toBeInTheDocument();
    expect(screen.queryByText("Current group: Builders")).not.toBeInTheDocument();
    expect(screen.getByText("Riley Chen")).toBeInTheDocument();
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
