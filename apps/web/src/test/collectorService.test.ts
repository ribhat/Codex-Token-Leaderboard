import { describe, expect, it } from "vitest";
import { createCollectorDevice, syncUsage } from "@/lib/collectorService";
import { hashToken } from "@/lib/crypto";
import { MemoryRepository } from "@/lib/memoryRepository";
import { ada, now } from "./testData";

const validRow = {
  usageDate: "2026-05-08",
  totalTokens: 100,
  inputTokens: 30,
  cachedInputTokens: 10,
  outputTokens: 40,
  reasoningOutputTokens: 20,
  responseCount: 2
};

describe("collectorService", () => {
  it("creates a device token, stores only a hash, and returns a public device", async () => {
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
    expect("tokenHash" in result.device).toBe(false);

    const stored = Array.from(repo.devices.values())[0];
    expect(stored.tokenHash).toBe(await hashToken("plain-device-token"));
    expect(stored.tokenHash).not.toBe("plain-device-token");
  });

  it("rejects blank injected collector tokens", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);

    await expect(
      createCollectorDevice({
        repo,
        userId: ada.id,
        platform: "windows",
        deviceLabel: null,
        now,
        token: "  "
      })
    ).rejects.toThrow("Collector token is required");
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
    const storedDevice = repo.devices.get(created.device.id);
    expect(storedDevice).toBeDefined();
    repo.devices.set(created.device.id, { ...storedDevice!, revokedAt: now });

    await expect(syncUsage({ repo, bearerToken: "", rows: [], now })).rejects.toThrow("Collector token is required");
    expect(repo.syncEvents.at(-1)).toMatchObject({
      deviceId: null,
      userId: null,
      success: false,
      message: "Collector token is required",
      daysSynced: 0
    });

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
    expect(Array.from(repo.usage.values())[0].source).toBe("codex-jsonl");
    expect(Array.from(repo.devices.values())[0].lastSeenAt).toBe("2026-05-08T13:00:00.000Z");
    expect(repo.syncEvents.filter((event) => event.success)).toHaveLength(2);
  });

  it("rejects invalid usage payloads before upsert and records a failed sync event", async () => {
    const cases = [
      { name: "negative token count", row: { ...validRow, totalTokens: -1 } },
      { name: "invalid date", row: { ...validRow, usageDate: "2026-02-30" } },
      { name: "fractional response count", row: { ...validRow, responseCount: 1.5 } },
      { name: "blank source", row: { ...validRow, source: "  " } }
    ];

    for (const testCase of cases) {
      const repo = new MemoryRepository();
      await repo.upsertProfile(ada);
      const created = await createCollectorDevice({
        repo,
        userId: ada.id,
        platform: "windows",
        deviceLabel: null,
        now,
        token: `${testCase.name}-token`
      });

      await expect(syncUsage({ repo, bearerToken: `${testCase.name}-token`, rows: [testCase.row], now })).rejects.toThrow(
        "Invalid usage payload"
      );

      expect(repo.usage.size).toBe(0);
      expect(repo.syncEvents.at(-1)).toMatchObject({
        deviceId: created.device.id,
        userId: ada.id,
        success: false,
        message: "Invalid usage payload",
        daysSynced: 0
      });
    }
  });

  it("records successful days synced from repository upsert results", async () => {
    class EmptyUpsertRepository extends MemoryRepository {
      async upsertUsageDaily(userId: string, rows: Parameters<MemoryRepository["upsertUsageDaily"]>[1], seenAt: string) {
        await super.upsertUsageDaily(userId, rows, seenAt);
        return [];
      }
    }

    const repo = new EmptyUpsertRepository();
    await repo.upsertProfile(ada);
    await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "windows",
      deviceLabel: null,
      now,
      token: "valid-token"
    });

    await syncUsage({ repo, bearerToken: "valid-token", rows: [validRow], now });

    expect(repo.syncEvents.at(-1)).toMatchObject({
      success: true,
      message: "Sync complete",
      daysSynced: 0
    });
  });
});
