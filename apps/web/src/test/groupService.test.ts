import { describe, expect, it, vi } from "vitest";
import { createGroup, joinGroup, listGroups } from "@/lib/groupService";
import type { AppRepository } from "@/lib/repository";
import { MemoryRepository } from "@/lib/memoryRepository";
import { hashToken } from "@/lib/crypto";
import { ada, grace, now } from "./testData";

describe("groupService", () => {
  it("creates a group with owner membership and a one-time invite code", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);

    const result = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "America/Los_Angeles",
      now,
      inviteCode: "invite-secret"
    });

    expect(result.group.name).toBe("Friday Builders");
    expect(result.inviteCode).toBe("invite-secret");
    await expect(repo.isGroupMember(result.group.id, ada.id)).resolves.toBe(true);
    expect(result.group).not.toHaveProperty("inviteCodeHash");
    await expect(repo.getGroup(result.group.id)).resolves.toMatchObject({
      inviteCodeHash: await hashToken("invite-secret")
    });
  });

  it("creates a fallback profile before creating a first group for a fresh user", async () => {
    const repo = new MemoryRepository();

    const result = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "America/Los_Angeles",
      now,
      inviteCode: "invite-secret"
    });

    await expect(repo.getProfile(ada.id)).resolves.toMatchObject({
      id: ada.id,
      displayName: "Codex user user-ada"
    });
    await expect(repo.isGroupMember(result.group.id, ada.id)).resolves.toBe(true);
  });

  it("delegates group and owner creation to one repository method", async () => {
    const group = {
      id: "group-1",
      name: "Friday Builders",
      creatorId: ada.id,
      inviteCodeHash: await hashToken("invite-secret"),
      timezone: "UTC",
      createdAt: now
    };
    const repo = {
      getProfile: vi.fn().mockResolvedValue(ada),
      createGroup: vi.fn(),
      createGroupWithOwner: vi.fn().mockResolvedValue(group),
      addGroupMember: vi.fn()
    } as unknown as AppRepository;

    await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "invite-secret"
    });

    expect(repo.createGroupWithOwner).toHaveBeenCalledWith({
      name: "Friday Builders",
      creatorId: ada.id,
      inviteCodeHash: await hashToken("invite-secret"),
      timezone: "UTC",
      now
    });
    expect(repo.createGroup).not.toHaveBeenCalled();
    expect(repo.addGroupMember).not.toHaveBeenCalled();
  });

  it("joins a group by invite code idempotently", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await repo.upsertProfile(grace);
    const created = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "invite-secret"
    });

    const firstJoin = await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now });
    const secondJoin = await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now });

    expect(firstJoin.group.id).toBe(created.group.id);
    expect(secondJoin.group.id).toBe(created.group.id);
    expect(firstJoin.group).not.toHaveProperty("inviteCodeHash");
    expect(secondJoin.group).not.toHaveProperty("inviteCodeHash");
    const members = await repo.listGroupMembers(created.group.id);
    expect(members.map((member) => member.userId).sort()).toEqual([ada.id, grace.id].sort());
  });

  it("lists groups the user belongs to without exposing invite hashes", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await repo.upsertProfile(grace);
    const first = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "first-secret"
    });
    const second = await createGroup({
      repo,
      userId: grace.id,
      name: "Weekend Builders",
      timezone: "UTC",
      now: "2026-05-08T13:00:00.000Z",
      inviteCode: "second-secret"
    });
    await joinGroup({ repo, userId: ada.id, inviteCode: "second-secret", now: "2026-05-08T14:00:00.000Z" });

    const result = await listGroups({ repo, userId: ada.id });

    expect(result.groups.map((group) => group.name)).toEqual([first.group.name, second.group.name]);
    for (const group of result.groups) {
      expect(group).not.toHaveProperty("inviteCodeHash");
    }
  });

  it("keeps the owner role when the owner joins by invite", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    const created = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "invite-secret"
    });

    await joinGroup({ repo, userId: ada.id, inviteCode: "invite-secret", now: "2026-05-08T13:00:00.000Z" });

    const members = await repo.listGroupMembers(created.group.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: ada.id,
      role: "owner",
      joinedAt: now
    });
  });

  it("keeps the original joinedAt when an existing member rejoins", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await repo.upsertProfile(grace);
    const created = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "invite-secret"
    });

    await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now: "2026-05-08T13:00:00.000Z" });
    await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now: "2026-05-08T14:00:00.000Z" });

    const members = await repo.listGroupMembers(created.group.id);
    expect(members.find((member) => member.userId === grace.id)).toMatchObject({
      role: "member",
      joinedAt: "2026-05-08T13:00:00.000Z"
    });
  });

  it("rejects an invalid invite code", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(grace);

    await expect(joinGroup({ repo, userId: grace.id, inviteCode: "missing", now })).rejects.toThrow("Invite code is invalid");
  });
});
