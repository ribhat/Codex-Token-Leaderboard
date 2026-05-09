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

type SupabaseError = {
  code?: string;
  message: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type SupabaseClientLike = {
  from(tableName: string): any;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hide_exact_totals: boolean;
};

type GroupRow = {
  id: string;
  name: string;
  creator_id: string;
  invite_code_hash: string;
  timezone: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

type GroupMemberWithProfileRow = GroupMemberRow & {
  profiles: ProfileRow | ProfileRow[] | null;
};

type CollectorDeviceRow = {
  id: string;
  user_id: string;
  token_hash: string;
  platform: string;
  device_label: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type UsageDailyRow = {
  user_id: string;
  usage_date: string;
  source: string;
  total_tokens: number | string;
  input_tokens: number | string;
  cached_input_tokens: number | string;
  output_tokens: number | string;
  reasoning_output_tokens: number | string;
  response_count: number;
  updated_at: string;
};

type UsageDailyUpsertRow = {
  user_id: string;
  usage_date: string;
  source: string;
  total_tokens: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  response_count: number;
  updated_at: string;
};

type SyncEventRow = {
  id: string;
  device_id: string | null;
  user_id: string | null;
  success: boolean;
  message: string | null;
  days_synced: number;
  created_at: string;
};

function throwIfError(error: SupabaseError | null): asserts error is null {
  if (error) {
    throw new Error(error.message);
  }
}

function isDuplicateError(error: SupabaseError | null) {
  return error?.code === "23505";
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    avatarUrl: row.avatar_url,
    hideExactTotals: row.hide_exact_totals
  };
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    creatorId: row.creator_id,
    inviteCodeHash: row.invite_code_hash,
    timezone: row.timezone,
    createdAt: row.created_at
  };
}

function mapGroupMember(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at
  };
}

function mapCollectorDevice(row: CollectorDeviceRow): CollectorDevice {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    platform: row.platform,
    deviceLabel: row.device_label,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

function mapUsageDaily(row: UsageDailyRow): UsageDaily {
  return {
    userId: row.user_id,
    usageDate: row.usage_date,
    source: row.source,
    totalTokens: toNumber(row.total_tokens),
    inputTokens: toNumber(row.input_tokens),
    cachedInputTokens: toNumber(row.cached_input_tokens),
    outputTokens: toNumber(row.output_tokens),
    reasoningOutputTokens: toNumber(row.reasoning_output_tokens),
    responseCount: row.response_count,
    updatedAt: row.updated_at
  };
}

function mapSyncEvent(row: SyncEventRow): SyncEvent {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    success: row.success,
    message: row.message,
    daysSynced: row.days_synced,
    createdAt: row.created_at
  };
}

function profileFromJoin(row: GroupMemberWithProfileRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (!profile) {
    throw new Error(`Missing profile for ${row.user_id}`);
  }
  return profile;
}

function dedupeUsageRows(userId: UserId, rows: UsageAggregateInput[], now: string) {
  const upsertRows = new Map<string, UsageDailyUpsertRow>();

  for (const row of rows) {
    const source = row.source ?? "codex-jsonl";
    upsertRows.set(`${row.usageDate}\0${source}`, {
      user_id: userId,
      usage_date: row.usageDate,
      source,
      total_tokens: row.totalTokens,
      input_tokens: row.inputTokens,
      cached_input_tokens: row.cachedInputTokens,
      output_tokens: row.outputTokens,
      reasoning_output_tokens: row.reasoningOutputTokens,
      response_count: row.responseCount,
      updated_at: now
    });
  }

  return Array.from(upsertRows.values());
}

export class SupabaseRepository implements AppRepository {
  constructor(private readonly supabase: SupabaseClientLike) {}

  async getProfile(userId: UserId) {
    const { data, error } = (await this.supabase
      .from("profiles")
      .select("id,display_name,avatar_url,hide_exact_totals")
      .eq("id", userId)
      .maybeSingle()) as SupabaseResult<ProfileRow | null>;
    throwIfError(error);
    return data ? mapProfile(data) : null;
  }

  async upsertProfile(profile: Profile) {
    const { data, error } = (await this.supabase
      .from("profiles")
      .upsert({
        id: profile.id,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        hide_exact_totals: profile.hideExactTotals
      })
      .select("id,display_name,avatar_url,hide_exact_totals")
      .single()) as SupabaseResult<ProfileRow>;
    throwIfError(error);
    return mapProfile(data);
  }

  async createGroup(input: CreateGroupInput) {
    const { data, error } = (await this.supabase
      .from("groups")
      .insert({
        name: input.name,
        creator_id: input.creatorId,
        invite_code_hash: input.inviteCodeHash,
        timezone: input.timezone,
        created_at: input.now
      })
      .select("id,name,creator_id,invite_code_hash,timezone,created_at")
      .single()) as SupabaseResult<GroupRow>;
    throwIfError(error);
    return mapGroup(data);
  }

  async getGroup(groupId: string) {
    const { data, error } = (await this.supabase
      .from("groups")
      .select("id,name,creator_id,invite_code_hash,timezone,created_at")
      .eq("id", groupId)
      .maybeSingle()) as SupabaseResult<GroupRow | null>;
    throwIfError(error);
    return data ? mapGroup(data) : null;
  }

  async getGroupByInviteHash(inviteCodeHash: string) {
    const { data, error } = (await this.supabase
      .from("groups")
      .select("id,name,creator_id,invite_code_hash,timezone,created_at")
      .eq("invite_code_hash", inviteCodeHash)
      .maybeSingle()) as SupabaseResult<GroupRow | null>;
    throwIfError(error);
    return data ? mapGroup(data) : null;
  }

  async addGroupMember(member: GroupMember) {
    const existing = await this.readGroupMember(member.groupId, member.userId);
    if (existing) {
      return existing;
    }

    const { data, error } = (await this.supabase
      .from("group_members")
      .insert({
        group_id: member.groupId,
        user_id: member.userId,
        role: member.role,
        joined_at: member.joinedAt
      })
      .select("group_id,user_id,role,joined_at")
      .single()) as SupabaseResult<GroupMemberRow | null>;

    if (isDuplicateError(error)) {
      const racedExisting = await this.readGroupMember(member.groupId, member.userId);
      if (racedExisting) {
        return racedExisting;
      }
    }

    throwIfError(error);
    if (!data) {
      throw new Error("Group member was not returned");
    }
    return mapGroupMember(data);
  }

  async isGroupMember(groupId: string, userId: string) {
    const { data, error } = (await this.supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle()) as SupabaseResult<{ group_id: string } | null>;
    throwIfError(error);
    return Boolean(data);
  }

  async listGroupMembers(groupId: string) {
    const { data, error } = (await this.supabase
      .from("group_members")
      .select("group_id,user_id,role,joined_at,profiles(id,display_name,avatar_url,hide_exact_totals)")
      .eq("group_id", groupId)) as SupabaseResult<GroupMemberWithProfileRow[]>;
    throwIfError(error);
    return data.map((row) => ({ ...mapGroupMember(row), profile: mapProfile(profileFromJoin(row)) }));
  }

  async createCollectorDevice(input: CreateDeviceInput) {
    const { data, error } = (await this.supabase
      .from("collector_devices")
      .insert({
        user_id: input.userId,
        token_hash: input.tokenHash,
        platform: input.platform,
        device_label: input.deviceLabel,
        created_at: input.now
      })
      .select("id,user_id,token_hash,platform,device_label,last_seen_at,revoked_at,created_at")
      .single()) as SupabaseResult<CollectorDeviceRow>;
    throwIfError(error);
    return mapCollectorDevice(data);
  }

  async getCollectorDeviceByTokenHash(tokenHash: string) {
    const { data, error } = (await this.supabase
      .from("collector_devices")
      .select("id,user_id,token_hash,platform,device_label,last_seen_at,revoked_at,created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()) as SupabaseResult<CollectorDeviceRow | null>;
    throwIfError(error);
    return data ? mapCollectorDevice(data) : null;
  }

  async updateCollectorDeviceSeen(deviceId: string, seenAt: string) {
    const { error } = (await this.supabase
      .from("collector_devices")
      .update({ last_seen_at: seenAt })
      .eq("id", deviceId)) as SupabaseResult<null>;
    throwIfError(error);
  }

  async upsertUsageDaily(userId: UserId, rows: UsageAggregateInput[], now: string) {
    if (rows.length === 0) {
      return [];
    }

    const upsertRows = dedupeUsageRows(userId, rows, now);

    const { data, error } = (await this.supabase
      .from("usage_daily")
      .upsert(upsertRows, { onConflict: "user_id,usage_date,source" })
      .select(
        "user_id,usage_date,source,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens,response_count,updated_at"
      )) as SupabaseResult<UsageDailyRow[]>;
    throwIfError(error);
    return data.map(mapUsageDaily);
  }

  async listUsageForUsers(userIds: UserId[], startDate: string | null, endDate: string | null) {
    if (userIds.length === 0) {
      return [];
    }

    let query = this.supabase
      .from("usage_daily")
      .select(
        "user_id,usage_date,source,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens,response_count,updated_at"
      )
      .in("user_id", userIds);

    if (startDate) {
      query = query.gte("usage_date", startDate);
    }
    if (endDate) {
      query = query.lte("usage_date", endDate);
    }

    const { data, error } = (await query) as SupabaseResult<UsageDailyRow[]>;
    throwIfError(error);
    return data.map(mapUsageDaily);
  }

  async getLatestDeviceSeenByUser(userIds: UserId[]) {
    const result = new Map<UserId, string | null>(userIds.map((userId) => [userId, null]));
    if (userIds.length === 0) {
      return result;
    }

    const { data, error } = (await this.supabase
      .from("collector_devices")
      .select("user_id,last_seen_at")
      .in("user_id", userIds)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })) as SupabaseResult<Array<{ user_id: string; last_seen_at: string | null }>>;
    throwIfError(error);

    for (const row of data) {
      if (row.last_seen_at && !result.get(row.user_id)) {
        result.set(row.user_id, row.last_seen_at);
      }
    }

    return result;
  }

  async createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }) {
    const { data, error } = (await this.supabase
      .from("sync_events")
      .insert({
        device_id: event.deviceId,
        user_id: event.userId,
        success: event.success,
        message: event.message,
        days_synced: event.daysSynced,
        created_at: event.createdAt
      })
      .select("id,device_id,user_id,success,message,days_synced,created_at")
      .single()) as SupabaseResult<SyncEventRow>;
    throwIfError(error);
    return mapSyncEvent(data);
  }

  private async readGroupMember(groupId: string, userId: string) {
    const { data, error } = (await this.supabase
      .from("group_members")
      .select("group_id,user_id,role,joined_at")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle()) as SupabaseResult<GroupMemberRow | null>;
    throwIfError(error);
    return data ? mapGroupMember(data) : null;
  }
}
