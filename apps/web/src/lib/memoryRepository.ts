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

function clone<T extends object>(value: T): T {
  return { ...value };
}

export class MemoryRepository implements AppRepository {
  profiles = new Map<string, Profile>();
  groups = new Map<string, Group>();
  members = new Map<string, GroupMember>();
  devices = new Map<string, CollectorDevice>();
  usage = new Map<string, UsageDaily>();
  syncEvents: SyncEvent[] = [];

  private sequence = 0;

  private nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  async getProfile(userId: string) {
    const profile = this.profiles.get(userId);
    return profile ? clone(profile) : null;
  }

  async upsertProfile(profile: Profile) {
    const stored = clone(profile);
    this.profiles.set(profile.id, stored);
    return clone(stored);
  }

  async createGroup(input: CreateGroupInput) {
    if (Array.from(this.groups.values()).some((group) => group.inviteCodeHash === input.inviteCodeHash)) {
      throw new Error("Duplicate invite code hash");
    }

    const group: Group = {
      id: this.nextId("group"),
      name: input.name,
      creatorId: input.creatorId,
      inviteCodeHash: input.inviteCodeHash,
      timezone: input.timezone,
      createdAt: input.now
    };
    this.groups.set(group.id, clone(group));
    return clone(group);
  }

  async createGroupWithOwner(input: CreateGroupInput) {
    const group = await this.createGroup(input);
    try {
      await this.addGroupMember({
        groupId: group.id,
        userId: input.creatorId,
        role: "owner",
        joinedAt: input.now
      });
    } catch (error) {
      this.groups.delete(group.id);
      throw error;
    }
    return group;
  }

  async getGroup(groupId: string) {
    const group = this.groups.get(groupId);
    return group ? clone(group) : null;
  }

  async getGroupByInviteHash(inviteCodeHash: string) {
    const group = Array.from(this.groups.values()).find((value) => value.inviteCodeHash === inviteCodeHash);
    return group ? clone(group) : null;
  }

  async addGroupMember(member: GroupMember) {
    const existing = this.members.get(`${member.groupId}:${member.userId}`);
    if (existing) {
      return clone(existing);
    }

    const stored = clone(member);
    this.members.set(`${member.groupId}:${member.userId}`, stored);
    return clone(stored);
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
        return { ...clone(member), profile: clone(profile) };
      });
  }

  async createCollectorDevice(input: CreateDeviceInput) {
    if (Array.from(this.devices.values()).some((device) => device.tokenHash === input.tokenHash)) {
      throw new Error("Duplicate token hash");
    }

    const device: CollectorDevice = {
      id: this.nextId("device"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      platform: input.platform,
      deviceLabel: input.deviceLabel,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: input.now
    };
    this.devices.set(device.id, clone(device));
    return clone(device);
  }

  async getCollectorDeviceByTokenHash(tokenHash: string) {
    const device = Array.from(this.devices.values()).find((value) => value.tokenHash === tokenHash);
    return device ? clone(device) : null;
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
      this.usage.set(`${userId}:${row.usageDate}:${source}`, clone(usage));
      return clone(usage);
    });
  }

  async listUsageForUsers(userIds: string[], startDate: string | null, endDate: string | null) {
    const userSet = new Set(userIds);
    return Array.from(this.usage.values())
      .filter((row) => {
        if (!userSet.has(row.userId)) return false;
        if (startDate && row.usageDate < startDate) return false;
        if (endDate && row.usageDate > endDate) return false;
        return true;
      })
      .map((row) => clone(row));
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
    const syncEvent: SyncEvent = { id: this.nextId("sync"), ...event };
    this.syncEvents.push(clone(syncEvent));
    return clone(syncEvent);
  }
}
