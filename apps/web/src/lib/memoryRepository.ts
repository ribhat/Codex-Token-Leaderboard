import type { AppRepository, CreateDeviceInput, CreateGroupInput } from "./repository";
import type {
  CollectorDevice,
  Group,
  GroupMember,
  Profile,
  SyncEvent,
  UsageAggregateInput,
  UsageDaily,
  UserId
} from "./types";

let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export class MemoryRepository implements AppRepository {
  profiles = new Map<string, Profile>();
  groups = new Map<string, Group>();
  members = new Map<string, GroupMember>();
  devices = new Map<string, CollectorDevice>();
  usage = new Map<string, UsageDaily>();
  syncEvents: SyncEvent[] = [];

  async getProfile(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async upsertProfile(profile: Profile) {
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async createGroup(input: CreateGroupInput) {
    const group: Group = {
      id: nextId("group"),
      name: input.name,
      creatorId: input.creatorId,
      inviteCodeHash: input.inviteCodeHash,
      timezone: input.timezone,
      createdAt: input.now
    };
    this.groups.set(group.id, group);
    return group;
  }

  async getGroup(groupId: string) {
    return this.groups.get(groupId) ?? null;
  }

  async getGroupByInviteHash(inviteCodeHash: string) {
    return Array.from(this.groups.values()).find((group) => group.inviteCodeHash === inviteCodeHash) ?? null;
  }

  async addGroupMember(member: GroupMember) {
    this.members.set(`${member.groupId}:${member.userId}`, member);
    return member;
  }

  async isGroupMember(groupId: string, userId: string) {
    return this.members.has(`${groupId}:${userId}`);
  }

  async listGroupMembers(groupId: string) {
    return Array.from(this.members.values())
      .filter((member) => member.groupId === groupId)
      .map((member) => {
        const profile = this.profiles.get(member.userId);
        if (!profile) {
          throw new Error(`Missing profile for ${member.userId}`);
        }
        return { ...member, profile };
      });
  }

  async createCollectorDevice(input: CreateDeviceInput) {
    const device: CollectorDevice = {
      id: nextId("device"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      platform: input.platform,
      deviceLabel: input.deviceLabel,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: input.now
    };
    this.devices.set(device.id, device);
    return device;
  }

  async getCollectorDeviceByTokenHash(tokenHash: string) {
    return Array.from(this.devices.values()).find((device) => device.tokenHash === tokenHash) ?? null;
  }

  async updateCollectorDeviceSeen(deviceId: string, seenAt: string) {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.set(deviceId, { ...device, lastSeenAt: seenAt });
    }
  }

  async upsertUsageDaily(userId: string, rows: UsageAggregateInput[], now: string) {
    return rows.map((row) => {
      const source = row.source ?? "codex-jsonl";
      const usage: UsageDaily = {
        userId,
        usageDate: row.usageDate,
        source,
        totalTokens: row.totalTokens,
        inputTokens: row.inputTokens,
        cachedInputTokens: row.cachedInputTokens,
        outputTokens: row.outputTokens,
        reasoningOutputTokens: row.reasoningOutputTokens,
        responseCount: row.responseCount,
        updatedAt: now
      };
      this.usage.set(`${userId}:${row.usageDate}:${source}`, usage);
      return usage;
    });
  }

  async listUsageForUsers(userIds: string[], startDate: string | null, endDate: string | null) {
    const userSet = new Set(userIds);
    return Array.from(this.usage.values()).filter((row) => {
      if (!userSet.has(row.userId)) return false;
      if (startDate && row.usageDate < startDate) return false;
      if (endDate && row.usageDate > endDate) return false;
      return true;
    });
  }

  async getLatestDeviceSeenByUser(userIds: UserId[]) {
    const result = new Map<UserId, string | null>();
    for (const userId of userIds) {
      const seen =
        Array.from(this.devices.values())
          .filter((device) => device.userId === userId && !device.revokedAt)
          .map((device) => device.lastSeenAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null;
      result.set(userId, seen);
    }
    return result;
  }

  async createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }) {
    const syncEvent: SyncEvent = { id: nextId("sync"), ...event };
    this.syncEvents.push(syncEvent);
    return syncEvent;
  }
}
