import { generateToken, hashToken } from "./crypto";
import type { AppRepository } from "./repository";
import type { Group, UserId } from "./types";

type CreateGroupArgs = {
  repo: AppRepository;
  userId: UserId;
  name: string;
  timezone?: string;
  now: string;
  inviteCode?: string;
};

type JoinGroupArgs = {
  repo: AppRepository;
  userId: UserId;
  inviteCode: string;
  now: string;
};

export async function createGroup(args: CreateGroupArgs): Promise<{ group: Group; inviteCode: string }> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new Error("Group name is required");
  }

  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const inviteCode = args.inviteCode ?? generateToken(18);
  const group = await args.repo.createGroup({
    name: trimmedName,
    creatorId: args.userId,
    inviteCodeHash: await hashToken(inviteCode),
    timezone: args.timezone ?? "UTC",
    now: args.now
  });

  await args.repo.addGroupMember({
    groupId: group.id,
    userId: args.userId,
    role: "owner",
    joinedAt: args.now
  });

  return { group, inviteCode };
}

export async function joinGroup(args: JoinGroupArgs): Promise<{ group: Group }> {
  const inviteCode = args.inviteCode.trim();
  if (!inviteCode) {
    throw new Error("Invite code is required");
  }

  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const group = await args.repo.getGroupByInviteHash(await hashToken(inviteCode));
  if (!group) {
    throw new Error("Invite code is invalid");
  }

  await args.repo.addGroupMember({
    groupId: group.id,
    userId: args.userId,
    role: "member",
    joinedAt: args.now
  });

  return { group };
}
