import type {
  CollectorDevice,
  Group,
  GroupId,
  GroupMember,
  Profile,
  SyncEvent,
  UsageAggregateInput,
  UsageDaily,
  UserId
} from "./types";

export type CreateGroupInput = {
  name: string;
  creatorId: UserId;
  inviteCodeHash: string;
  timezone: string;
  now: string;
};

export type CreateDeviceInput = {
  userId: UserId;
  tokenHash: string;
  platform: string;
  deviceLabel: string | null;
  now: string;
};

export type AppRepository = {
  getProfile(userId: UserId): Promise<Profile | null>;
  upsertProfile(profile: Profile): Promise<Profile>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  createGroupWithOwner(input: CreateGroupInput): Promise<Group>;
  getGroup(groupId: GroupId): Promise<Group | null>;
  getGroupByInviteHash(inviteCodeHash: string): Promise<Group | null>;
  addGroupMember(member: GroupMember): Promise<GroupMember>;
  isGroupMember(groupId: GroupId, userId: UserId): Promise<boolean>;
  listGroupMembers(groupId: GroupId): Promise<Array<GroupMember & { profile: Profile }>>;
  createCollectorDevice(input: CreateDeviceInput): Promise<CollectorDevice>;
  getCollectorDeviceByTokenHash(tokenHash: string): Promise<CollectorDevice | null>;
  updateCollectorDeviceSeen(deviceId: string, seenAt: string): Promise<void>;
  upsertUsageDaily(userId: UserId, rows: UsageAggregateInput[], now: string): Promise<UsageDaily[]>;
  listUsageForUsers(userIds: UserId[], startDate: string | null, endDate: string | null): Promise<UsageDaily[]>;
  getLatestDeviceSeenByUser(userIds: UserId[]): Promise<Map<UserId, string | null>>;
  createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }): Promise<SyncEvent>;
};
