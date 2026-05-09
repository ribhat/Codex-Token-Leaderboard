import { generateToken, hashToken } from "./crypto";
import type { AppRepository } from "./repository";
import type { CollectorDevice, UsageAggregateInput, UserId } from "./types";

export type PublicCollectorDevice = Omit<CollectorDevice, "tokenHash">;

type CreateCollectorDeviceArgs = {
  repo: AppRepository;
  userId: UserId;
  platform: string;
  deviceLabel: string | null;
  now: string;
  token?: string;
};

type SyncUsageArgs = {
  repo: AppRepository;
  bearerToken: string;
  rows: UsageAggregateInput[];
  now: string;
};

const usageCountFields = [
  "totalTokens",
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "responseCount"
] satisfies Array<keyof UsageAggregateInput>;

function toPublicCollectorDevice(device: CollectorDevice): PublicCollectorDevice {
  return {
    id: device.id,
    userId: device.userId,
    platform: device.platform,
    deviceLabel: device.deviceLabel,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    createdAt: device.createdAt
  };
}

function isRealUsageDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeUsageRows(rows: UsageAggregateInput[]) {
  return rows.map((row) => {
    if (!isRealUsageDate(row.usageDate)) {
      throw new Error("Invalid usage payload");
    }

    for (const field of usageCountFields) {
      const value = row[field];
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error("Invalid usage payload");
      }
    }

    const source = row.source?.trim() ?? "codex-jsonl";
    if (!source) {
      throw new Error("Invalid usage payload");
    }

    return {
      ...row,
      source
    };
  });
}

export async function createCollectorDevice(
  args: CreateCollectorDeviceArgs
): Promise<{ device: PublicCollectorDevice; token: string }> {
  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const platform = args.platform.trim();
  if (!platform) {
    throw new Error("Platform is required");
  }

  const token = args.token?.trim() ?? generateToken();
  if (!token) {
    throw new Error("Collector token is required");
  }

  const device = await args.repo.createCollectorDevice({
    userId: args.userId,
    tokenHash: await hashToken(token),
    platform,
    deviceLabel: args.deviceLabel,
    now: args.now
  });

  return { device: toPublicCollectorDevice(device), token };
}

export async function syncUsage(args: SyncUsageArgs) {
  const bearerToken = args.bearerToken.trim();
  if (!bearerToken) {
    await args.repo.createSyncEvent({
      deviceId: null,
      userId: null,
      success: false,
      message: "Collector token is required",
      daysSynced: 0,
      createdAt: args.now
    });
    throw new Error("Collector token is required");
  }

  const device = await args.repo.getCollectorDeviceByTokenHash(await hashToken(bearerToken));
  if (!device) {
    await args.repo.createSyncEvent({
      deviceId: null,
      userId: null,
      success: false,
      message: "Collector token is invalid",
      daysSynced: 0,
      createdAt: args.now
    });
    throw new Error("Collector token is invalid");
  }

  if (device.revokedAt) {
    await args.repo.createSyncEvent({
      deviceId: device.id,
      userId: device.userId,
      success: false,
      message: "Collector token is revoked",
      daysSynced: 0,
      createdAt: args.now
    });
    throw new Error("Collector token is revoked");
  }

  let rows: UsageAggregateInput[];
  try {
    rows = normalizeUsageRows(args.rows);
  } catch (error) {
    await args.repo.createSyncEvent({
      deviceId: device.id,
      userId: device.userId,
      success: false,
      message: "Invalid usage payload",
      daysSynced: 0,
      createdAt: args.now
    });
    throw error;
  }

  const upserted = await args.repo.upsertUsageDaily(device.userId, rows, args.now);
  await args.repo.updateCollectorDeviceSeen(device.id, args.now);
  await args.repo.createSyncEvent({
    deviceId: device.id,
    userId: device.userId,
    success: true,
    message: "Sync complete",
    daysSynced: upserted.length,
    createdAt: args.now
  });

  return { rows: upserted };
}
