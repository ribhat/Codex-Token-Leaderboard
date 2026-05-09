import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../lib/memoryRepository";
import { ada, grace, now } from "./testData";

describe("MemoryRepository", () => {
  it("starts generated group ids from group-1 for each repository instance", async () => {
    const firstRepo = new MemoryRepository();
    const secondRepo = new MemoryRepository();

    const firstGroup = await firstRepo.createGroup({
      name: "First group",
      creatorId: ada.id,
      inviteCodeHash: "invite-one",
      timezone: "America/Los_Angeles",
      now
    });
    const secondGroup = await secondRepo.createGroup({
      name: "Second group",
      creatorId: ada.id,
      inviteCodeHash: "invite-two",
      timezone: "America/Los_Angeles",
      now
    });

    expect(firstGroup.id).toBe("group-1");
    expect(secondGroup.id).toBe("group-1");
  });

  it("clones method-written and method-read values so returned object mutations do not mutate stored state", async () => {
    const repo = new MemoryRepository();

    const profile = await repo.upsertProfile(ada);
    profile.displayName = "Mutated Ada";
    expect((await repo.getProfile(ada.id))?.displayName).toBe("Ada");

    const readProfile = await repo.getProfile(ada.id);
    if (!readProfile) throw new Error("Expected profile");
    readProfile.displayName = "Read Mutation";
    expect((await repo.getProfile(ada.id))?.displayName).toBe("Ada");

    const group = await repo.createGroup({
      name: "Original Group",
      creatorId: ada.id,
      inviteCodeHash: "invite-clone",
      timezone: "America/Los_Angeles",
      now
    });
    group.name = "Mutated Group";
    expect((await repo.getGroup(group.id))?.name).toBe("Original Group");

    const readGroup = await repo.getGroup(group.id);
    if (!readGroup) throw new Error("Expected group");
    readGroup.name = "Read Group Mutation";
    expect((await repo.getGroup(group.id))?.name).toBe("Original Group");

    const device = await repo.createCollectorDevice({
      userId: ada.id,
      tokenHash: "token-clone",
      platform: "darwin",
      deviceLabel: "Ada laptop",
      now
    });
    device.deviceLabel = "Mutated device";
    expect((await repo.getCollectorDeviceByTokenHash("token-clone"))?.deviceLabel).toBe("Ada laptop");

    const readDevice = await repo.getCollectorDeviceByTokenHash("token-clone");
    if (!readDevice) throw new Error("Expected device");
    readDevice.deviceLabel = "Read device mutation";
    expect((await repo.getCollectorDeviceByTokenHash("token-clone"))?.deviceLabel).toBe("Ada laptop");

    const [usage] = await repo.upsertUsageDaily(
      ada.id,
      [
        {
          usageDate: "2026-05-08",
          totalTokens: 100,
          inputTokens: 40,
          cachedInputTokens: 10,
          outputTokens: 50,
          reasoningOutputTokens: 5,
          responseCount: 2
        }
      ],
      now
    );
    usage.totalTokens = 999;
    expect((await repo.listUsageForUsers([ada.id], null, null))[0]?.totalTokens).toBe(100);

    const [readUsage] = await repo.listUsageForUsers([ada.id], null, null);
    readUsage.totalTokens = 888;
    expect((await repo.listUsageForUsers([ada.id], null, null))[0]?.totalTokens).toBe(100);

    const syncEvent = await repo.createSyncEvent({
      deviceId: device.id,
      userId: ada.id,
      success: true,
      message: null,
      daysSynced: 1,
      createdAt: now
    });
    syncEvent.message = "Mutated sync event";
    expect(repo.syncEvents[0]?.message).toBeNull();
  });

  it("rejects duplicate invite code hashes and token hashes", async () => {
    const repo = new MemoryRepository();

    await repo.createGroup({
      name: "Ada group",
      creatorId: ada.id,
      inviteCodeHash: "duplicate-invite",
      timezone: "America/Los_Angeles",
      now
    });
    await expect(
      repo.createGroup({
        name: "Grace group",
        creatorId: grace.id,
        inviteCodeHash: "duplicate-invite",
        timezone: "America/Los_Angeles",
        now
      })
    ).rejects.toThrow("Duplicate invite code hash");

    await repo.createCollectorDevice({
      userId: ada.id,
      tokenHash: "duplicate-token",
      platform: "darwin",
      deviceLabel: null,
      now
    });
    await expect(
      repo.createCollectorDevice({
        userId: grace.id,
        tokenHash: "duplicate-token",
        platform: "linux",
        deviceLabel: null,
        now
      })
    ).rejects.toThrow("Duplicate token hash");
  });

  it("keeps usage upsert replacement and default source semantics", async () => {
    const repo = new MemoryRepository();

    await repo.upsertUsageDaily(
      ada.id,
      [
        {
          usageDate: "2026-05-08",
          totalTokens: 100,
          inputTokens: 40,
          cachedInputTokens: 10,
          outputTokens: 50,
          reasoningOutputTokens: 5,
          responseCount: 2
        }
      ],
      now
    );
    await repo.upsertUsageDaily(
      ada.id,
      [
        {
          usageDate: "2026-05-08",
          totalTokens: 200,
          inputTokens: 80,
          cachedInputTokens: 20,
          outputTokens: 100,
          reasoningOutputTokens: 10,
          responseCount: 4
        }
      ],
      "2026-05-08T13:00:00.000Z"
    );

    const usage = await repo.listUsageForUsers([ada.id], null, null);

    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      source: "codex-jsonl",
      totalTokens: 200,
      updatedAt: "2026-05-08T13:00:00.000Z"
    });
  });
});
