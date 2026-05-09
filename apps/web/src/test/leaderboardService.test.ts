import { describe, expect, it } from "vitest";
import { createGroup } from "@/lib/groupService";
import { getLeaderboard } from "@/lib/leaderboardService";
import { MemoryRepository } from "@/lib/memoryRepository";
import { ada, grace, linus, now } from "./testData";

async function setupRepo() {
  const repo = new MemoryRepository();
  await repo.upsertProfile(ada);
  await repo.upsertProfile(grace);
  await repo.upsertProfile(linus);
  const { group } = await createGroup({
    repo,
    userId: ada.id,
    name: "Friday Builders",
    timezone: "UTC",
    now,
    inviteCode: "invite-secret"
  });
  await repo.addGroupMember({ groupId: group.id, userId: grace.id, role: "member", joinedAt: now });
  await repo.upsertUsageDaily(
    ada.id,
    [
      {
        usageDate: "2026-05-08",
        totalTokens: 500,
        inputTokens: 200,
        cachedInputTokens: 50,
        outputTokens: 200,
        reasoningOutputTokens: 50,
        responseCount: 3
      },
      {
        usageDate: "2026-05-01",
        totalTokens: 100,
        inputTokens: 40,
        cachedInputTokens: 10,
        outputTokens: 40,
        reasoningOutputTokens: 10,
        responseCount: 1
      },
      {
        usageDate: "2026-04-01",
        totalTokens: 1000,
        inputTokens: 400,
        cachedInputTokens: 100,
        outputTokens: 400,
        reasoningOutputTokens: 100,
        responseCount: 6
      }
    ],
    now
  );
  await repo.upsertUsageDaily(
    grace.id,
    [
      {
        usageDate: "2026-05-08",
        totalTokens: 700,
        inputTokens: 250,
        cachedInputTokens: 100,
        outputTokens: 250,
        reasoningOutputTokens: 100,
        responseCount: 4
      }
    ],
    now
  );
  return { repo, group };
}

describe("leaderboardService", () => {
  it("rejects viewers who are not group members", async () => {
    const { repo, group } = await setupRepo();

    await expect(getLeaderboard({ repo, viewerId: linus.id, groupId: group.id, range: "today", now })).rejects.toThrow(
      "Group not found"
    );
  });

  it("ranks members by today totals and masks exact totals when requested", async () => {
    const { repo, group } = await setupRepo();

    const result = await getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "today", now });

    expect(result.rows.map((row) => row.displayName)).toEqual(["Grace", "Ada"]);
    expect(result.rows[0]).toMatchObject({ rank: 1, isExactTotalHidden: true, totalTokens: null });
    expect("rawTotalTokens" in result.rows[0]).toBe(false);
    expect(result.rows[1]).toMatchObject({ rank: 2, isExactTotalHidden: false, totalTokens: 500 });
  });

  it("calculates week, month, year, and all ranges", async () => {
    const { repo, group } = await setupRepo();

    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "week", now })).resolves.toMatchObject({
      rows: [{ displayName: "Grace" }, { displayName: "Ada" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "month", now })).resolves.toMatchObject({
      rows: [{ displayName: "Grace" }, { displayName: "Ada" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "year", now })).resolves.toMatchObject({
      rows: [{ displayName: "Ada" }, { displayName: "Grace" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "all", now })).resolves.toMatchObject({
      rows: [{ displayName: "Ada" }, { displayName: "Grace" }]
    });
  });

  it("marks members stale when latest device seen is older than 24 hours", async () => {
    const { repo, group } = await setupRepo();
    await repo.createCollectorDevice({
      userId: ada.id,
      tokenHash: "hash",
      platform: "windows",
      deviceLabel: null,
      now: "2026-05-06T00:00:00.000Z"
    });
    const device = Array.from(repo.devices.values())[0];
    repo.devices.set(device.id, { ...device, lastSeenAt: "2026-05-06T00:00:00.000Z" });

    const result = await getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "today", now });

    expect(result.rows.find((row) => row.userId === ada.id)?.isStale).toBe(true);
  });
});
