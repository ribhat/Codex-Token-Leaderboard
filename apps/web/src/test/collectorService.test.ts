import { describe, expect, it } from "vitest";
import { createCollectorDevice, syncUsage } from "@/lib/collectorService";
import { hashToken } from "@/lib/crypto";
import { MemoryRepository } from "@/lib/memoryRepository";
import { ada, now } from "./testData";

describe("collectorService", () => {
  it("creates a device token and stores only a hash", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);

    const result = await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "windows",
      deviceLabel: "Laptop",
      now,
      token: "plain-device-token"
    });

    expect(result.token).toBe("plain-device-token");
    expect(result.device.tokenHash).toBe(await hashToken("plain-device-token"));
    expect(result.device.tokenHash).not.toBe("plain-device-token");
  });

  it("rejects missing, invalid, and revoked collector tokens", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    const created = await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "darwin",
      deviceLabel: null,
      now,
      token: "valid-token"
    });
    repo.devices.set(created.device.id, { ...created.device, revokedAt: now });

    await expect(syncUsage({ repo, bearerToken: "", rows: [], now })).rejects.toThrow("Collector token is required");
    await expect(syncUsage({ repo, bearerToken: "wrong-token", rows: [], now })).rejects.toThrow(
      "Collector token is invalid"
    );
    await expect(syncUsage({ repo, bearerToken: "valid-token", rows: [], now })).rejects.toThrow(
      "Collector token is revoked"
    );
  });

  it("upserts daily usage idempotently and marks device seen", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "windows",
      deviceLabel: null,
      now,
      token: "valid-token"
    });

    const rows = [
      {
        usageDate: "2026-05-08",
        totalTokens: 100,
        inputTokens: 30,
        cachedInputTokens: 10,
        outputTokens: 40,
        reasoningOutputTokens: 20,
        responseCount: 2
      }
    ];

    await syncUsage({ repo, bearerToken: "valid-token", rows, now });
    await syncUsage({
      repo,
      bearerToken: "valid-token",
      rows: [{ ...rows[0], totalTokens: 150 }],
      now: "2026-05-08T13:00:00.000Z"
    });

    expect(Array.from(repo.usage.values())).toHaveLength(1);
    expect(Array.from(repo.usage.values())[0].totalTokens).toBe(150);
    expect(Array.from(repo.devices.values())[0].lastSeenAt).toBe("2026-05-08T13:00:00.000Z");
    expect(repo.syncEvents.filter((event) => event.success)).toHaveLength(2);
  });
});
