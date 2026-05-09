import { describe, expect, it } from "vitest";
import { createGroup, joinGroup } from "@/lib/groupService";
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
    expect(result.group.inviteCodeHash).toBe(await hashToken("invite-secret"));
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
    const members = await repo.listGroupMembers(created.group.id);
    expect(members.map((member) => member.userId).sort()).toEqual([ada.id, grace.id].sort());
  });

  it("rejects an invalid invite code", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(grace);

    await expect(joinGroup({ repo, userId: grace.id, inviteCode: "missing", now })).rejects.toThrow("Invite code is invalid");
  });
});
