export type UserId = string;
export type GroupId = string;
export type DeviceId = string;

export type Profile = {
  id: UserId;
  displayName: string;
  avatarUrl: string | null;
  hideExactTotals: boolean;
};

export type Group = {
  id: GroupId;
  name: string;
  creatorId: UserId;
  inviteCodeHash: string;
  timezone: string;
  createdAt: string;
};

export type GroupMember = {
  groupId: GroupId;
  userId: UserId;
  role: "owner" | "member";
  joinedAt: string;
};

export type CollectorDevice = {
  id: DeviceId;
  userId: UserId;
  tokenHash: string;
  platform: string;
  deviceLabel: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type UsageDaily = {
  userId: UserId;
  usageDate: string;
  source: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  responseCount: number;
  updatedAt: string;
};

export type SyncEvent = {
  id: string;
  deviceId: DeviceId | null;
  userId: UserId | null;
  success: boolean;
  message: string | null;
  daysSynced: number;
  createdAt: string;
};

export type UsageAggregateInput = {
  usageDate: string;
  source?: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  responseCount: number;
};

export type LeaderboardRange = "today" | "week" | "month" | "year" | "all";
