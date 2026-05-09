import { getRangeBounds } from "./ranges";
import type { AppRepository } from "./repository";
import type { GroupId, LeaderboardRange, UserId } from "./types";

export type LeaderboardRow = {
  rank: number;
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
  totalTokens: number | null;
  rawTotalTokens: number;
  isExactTotalHidden: boolean;
  lastSyncedAt: string | null;
  isStale: boolean;
};

type GetLeaderboardArgs = {
  repo: AppRepository;
  viewerId: UserId;
  groupId: GroupId;
  range: LeaderboardRange;
  now: string;
};

export async function getLeaderboard(args: GetLeaderboardArgs): Promise<{ rows: LeaderboardRow[] }> {
  const canView = await args.repo.isGroupMember(args.groupId, args.viewerId);
  if (!canView) {
    throw new Error("Group not found");
  }

  const members = await args.repo.listGroupMembers(args.groupId);
  const userIds = members.map((member) => member.userId);
  const bounds = getRangeBounds(args.range, args.now);
  const usage = await args.repo.listUsageForUsers(userIds, bounds.startDate, bounds.endDate);
  const latestSeenByUser = await args.repo.getLatestDeviceSeenByUser(userIds);
  const staleCutoff = new Date(new Date(args.now).getTime() - 24 * 60 * 60 * 1000).toISOString();

  const totals = new Map<UserId, number>();
  for (const row of usage) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.totalTokens);
  }

  return {
    rows: members
      .map((member) => {
        const rawTotalTokens = totals.get(member.userId) ?? 0;
        const lastSyncedAt = latestSeenByUser.get(member.userId) ?? null;
        return {
          rank: 0,
          userId: member.userId,
          displayName: member.profile.displayName,
          avatarUrl: member.profile.avatarUrl,
          totalTokens: member.profile.hideExactTotals ? null : rawTotalTokens,
          rawTotalTokens,
          isExactTotalHidden: member.profile.hideExactTotals,
          lastSyncedAt,
          isStale: !lastSyncedAt || lastSyncedAt < staleCutoff
        };
      })
      .sort((a, b) => b.rawTotalTokens - a.rawTotalTokens || a.displayName.localeCompare(b.displayName))
      .map((row, index) => ({ ...row, rank: index + 1 }))
  };
}
