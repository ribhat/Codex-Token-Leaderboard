import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createDevicePost } from "@/app/api/collector/devices/route";
import { POST as syncPost } from "@/app/api/collector/sync/route";
import { POST as createGroupPost } from "@/app/api/groups/route";
import { POST as joinGroupPost } from "@/app/api/groups/join/route";
import { GET as leaderboardGet } from "@/app/api/groups/[id]/leaderboard/route";
import { createCollectorDevice, syncUsage } from "@/lib/collectorService";
import { createGroup, joinGroup } from "@/lib/groupService";
import { getLeaderboard } from "@/lib/leaderboardService";

const mocks = vi.hoisted(() => ({
  repo: { kind: "repo" },
  serviceClient: { kind: "client" },
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  SupabaseRepository: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  getLeaderboard: vi.fn(),
  createCollectorDevice: vi.fn(),
  syncUsage: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
  getUserIdFromRequest: mocks.getUserIdFromRequest
}));

vi.mock("@/lib/supabaseRepository", () => ({
  SupabaseRepository: mocks.SupabaseRepository
}));

vi.mock("@/lib/groupService", () => ({
  createGroup: mocks.createGroup,
  joinGroup: mocks.joinGroup
}));

vi.mock("@/lib/leaderboardService", () => ({
  getLeaderboard: mocks.getLeaderboard
}));

vi.mock("@/lib/collectorService", () => ({
  createCollectorDevice: mocks.createCollectorDevice,
  syncUsage: mocks.syncUsage
}));

describe("api route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserIdFromRequest.mockResolvedValue("user-1");
    mocks.createSupabaseServiceClient.mockReturnValue(mocks.serviceClient);
    mocks.SupabaseRepository.mockImplementation(
      class {
        constructor() {
          return mocks.repo;
        }
      } as never
    );
  });

  it("creates groups with dashboard auth and returns the service result without storage fields", async () => {
    mocks.createGroup.mockResolvedValue({
      group: {
        id: "group-1",
        name: "Builders",
        creatorId: "user-1",
        timezone: "UTC",
        createdAt: "2026-05-08T12:00:00.000Z"
      },
      inviteCode: "invite-code"
    });

    const response = await createGroupPost(
      new Request("http://localhost/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Builders", timezone: "UTC" })
      })
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.group).not.toHaveProperty("inviteCodeHash");
    expect(createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mocks.repo,
        userId: "user-1",
        name: "Builders",
        timezone: "UTC"
      })
    );
  });

  it("joins groups with dashboard auth and returns the public group shape", async () => {
    mocks.joinGroup.mockResolvedValue({
      group: {
        id: "group-1",
        name: "Builders",
        creatorId: "user-1",
        timezone: "UTC",
        createdAt: "2026-05-08T12:00:00.000Z"
      }
    });

    const response = await joinGroupPost(
      new Request("http://localhost/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: "invite-code" })
      })
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.group).not.toHaveProperty("inviteCodeHash");
    expect(joinGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mocks.repo,
        userId: "user-1",
        inviteCode: "invite-code"
      })
    );
  });

  it("rejects invalid leaderboard ranges before calling the service", async () => {
    const response = await leaderboardGet(new Request("http://localhost/api/groups/group-1/leaderboard?range=bad"), {
      params: Promise.resolve({ id: "group-1" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid leaderboard range" });
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated group creation requests", async () => {
    mocks.getUserIdFromRequest.mockRejectedValue(new Error("Authentication is required"));

    const response = await createGroupPost(
      new Request("http://localhost/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Builders", timezone: "UTC" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required" });
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated group join requests", async () => {
    mocks.getUserIdFromRequest.mockRejectedValue(new Error("Authentication is required"));

    const response = await joinGroupPost(
      new Request("http://localhost/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: "invite-code" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required" });
    expect(joinGroup).not.toHaveBeenCalled();
  });

  it("authenticates leaderboard requests before validating route-specific query params", async () => {
    mocks.getUserIdFromRequest.mockRejectedValue(new Error("Authentication is required"));

    const response = await leaderboardGet(new Request("http://localhost/api/groups/group-1/leaderboard?range=bad"), {
      params: Promise.resolve({ id: "group-1" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required" });
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated collector device creation requests", async () => {
    mocks.getUserIdFromRequest.mockRejectedValue(new Error("Authentication is required"));

    const response = await createDevicePost(
      new Request("http://localhost/api/collector/devices", {
        method: "POST",
        body: JSON.stringify({ platform: "windows" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required" });
    expect(createCollectorDevice).not.toHaveBeenCalled();
  });

  it("returns known validation errors as 400 without masking their messages", async () => {
    mocks.createGroup.mockRejectedValue(new Error("Group name is required"));

    const response = await createGroupPost(
      new Request("http://localhost/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Group name is required" });
  });

  it("masks internal dashboard errors with a generic 500 response", async () => {
    mocks.createGroup.mockRejectedValue(new Error("duplicate key value violates unique constraint profiles_pkey"));

    const response = await createGroupPost(
      new Request("http://localhost/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: "Builders" })
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("loads leaderboards with a default today range", async () => {
    mocks.getLeaderboard.mockResolvedValue({
      rows: [{ rank: 1, userId: "user-1", displayName: "Ada", totalTokens: 10 }]
    });

    const response = await leaderboardGet(new Request("http://localhost/api/groups/group-1/leaderboard"), {
      params: Promise.resolve({ id: "group-1" })
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.rows[0]).not.toHaveProperty("rawTotalTokens");
    expect(getLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mocks.repo,
        viewerId: "user-1",
        groupId: "group-1",
        range: "today"
      })
    );
  });

  it("creates collector devices and returns the one-time plaintext token without tokenHash", async () => {
    mocks.createCollectorDevice.mockResolvedValue({
      device: {
        id: "device-1",
        userId: "user-1",
        platform: "windows",
        deviceLabel: null,
        lastSeenAt: null,
        revokedAt: null,
        createdAt: "2026-05-08T12:00:00.000Z"
      },
      token: "plain-token"
    });

    const response = await createDevicePost(
      new Request("http://localhost/api/collector/devices", {
        method: "POST",
        body: JSON.stringify({ platform: "windows" })
      })
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.token).toBe("plain-token");
    expect(body.device).not.toHaveProperty("tokenHash");
    expect(createCollectorDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mocks.repo,
        userId: "user-1",
        platform: "windows",
        deviceLabel: null
      })
    );
  });

  it("passes empty collector tokens and malformed bodies through to syncUsage for auditing", async () => {
    mocks.syncUsage.mockResolvedValue({ rows: [] });

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        body: "{"
      })
    );

    expect(response.status).toBe(200);
    expect(syncUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mocks.repo,
        bearerToken: "",
        rows: undefined
      })
    );
  });

  it("passes undefined rows to syncUsage for non-object JSON bodies", async () => {
    mocks.syncUsage.mockResolvedValue({ rows: [] });

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        body: "null"
      })
    );

    expect(response.status).toBe(200);
    expect(syncUsage).toHaveBeenCalledWith(expect.objectContaining({ rows: undefined }));
  });

  it("returns 401 for missing collector tokens while preserving service auditing", async () => {
    mocks.syncUsage.mockRejectedValue(new Error("Collector token is required"));

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        body: JSON.stringify({ rows: [] })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Collector token is required" });
    expect(syncUsage).toHaveBeenCalledWith(expect.objectContaining({ bearerToken: "" }));
  });

  it("returns 401 for invalid collector tokens", async () => {
    mocks.syncUsage.mockRejectedValue(new Error("Collector token is invalid"));

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
        body: JSON.stringify({ rows: [] })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Collector token is invalid" });
  });

  it("returns 403 for revoked collector tokens", async () => {
    mocks.syncUsage.mockRejectedValue(new Error("Collector token is revoked"));

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        headers: { Authorization: "Bearer revoked-token" },
        body: JSON.stringify({ rows: [] })
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Collector token is revoked" });
  });

  it("returns 400 for invalid collector usage payloads", async () => {
    mocks.syncUsage.mockRejectedValue(new Error("Invalid usage payload"));

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({ rows: "bad" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid usage payload" });
  });

  it("masks internal collector sync errors with a generic 500 response", async () => {
    mocks.syncUsage.mockRejectedValue(new Error("duplicate key value violates unique constraint sync_events_pkey"));

    const response = await syncPost(
      new Request("http://localhost/api/collector/sync", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({ rows: [] })
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
