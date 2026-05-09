import { generateToken, hashToken } from "./crypto";
import type { AppRepository } from "./repository";
import type { CollectorDevice, UsageAggregateInput, UserId } from "./types";

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

export async function createCollectorDevice(
  args: CreateCollectorDeviceArgs
): Promise<{ device: CollectorDevice; token: string }> {
  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const platform = args.platform.trim();
  if (!platform) {
    throw new Error("Platform is required");
  }

  const token = args.token ?? generateToken();
  const device = await args.repo.createCollectorDevice({
    userId: args.userId,
    tokenHash: await hashToken(token),
    platform,
    deviceLabel: args.deviceLabel,
    now: args.now
  });

  return { device, token };
}

export async function syncUsage(args: SyncUsageArgs) {
  const bearerToken = args.bearerToken.trim();
  if (!bearerToken) {
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

  const rows = args.rows.map((row) => ({
    ...row,
    source: row.source ?? "codex-jsonl"
  }));

  const upserted = await args.repo.upsertUsageDaily(device.userId, rows, args.now);
  await args.repo.updateCollectorDeviceSeen(device.id, args.now);
  await args.repo.createSyncEvent({
    deviceId: device.id,
    userId: device.userId,
    success: true,
    message: "Sync complete",
    daysSynced: rows.length,
    createdAt: args.now
  });

  return { rows: upserted };
}
