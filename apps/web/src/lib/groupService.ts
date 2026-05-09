import { generateToken, hashToken } from "./crypto";
import { ensureProfile } from "./profileService";
import type { AppRepository } from "./repository";
import type { Group, UserId } from "./types";

export type PublicGroup = Omit<Group, "inviteCodeHash">;

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

function toPublicGroup(group: Group): PublicGroup {
  const { inviteCodeHash: _inviteCodeHash, ...publicGroup } = group;
  return publicGroup;
}

export async function createGroup(args: CreateGroupArgs): Promise<{ group: PublicGroup; inviteCode: string }> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new Error("Group name is required");
  }

  await ensureProfile(args.repo, args.userId);

  const inviteCode = args.inviteCode ?? generateToken(18);
  const group = await args.repo.createGroupWithOwner({
    name: trimmedName,
    creatorId: args.userId,
    inviteCodeHash: await hashToken(inviteCode),
    timezone: args.timezone ?? "UTC",
    now: args.now
  });

  return { group: toPublicGroup(group), inviteCode };
}

export async function joinGroup(args: JoinGroupArgs): Promise<{ group: PublicGroup }> {
  const inviteCode = args.inviteCode.trim();
  if (!inviteCode) {
    throw new Error("Invite code is required");
  }

  await ensureProfile(args.repo, args.userId);

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

  return { group: toPublicGroup(group) };
}
