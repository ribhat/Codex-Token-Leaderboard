import { describe, expect, it } from "vitest";
import { SupabaseRepository } from "@/lib/supabaseRepository";

const existingMembershipRow = {
  group_id: "group-1",
  user_id: "user-1",
  role: "owner",
  joined_at: "2026-05-08T12:00:00.000Z"
};

class GroupMemberSelectBuilder {
  constructor(private readonly row: typeof existingMembershipRow | null) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  async maybeSingle() {
    return { data: this.row, error: null };
  }
}

class DuplicateInsertBuilder {
  insert() {
    return this;
  }

  select() {
    return this;
  }

  async single() {
    return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
  }
}

class UsageDailyUpsertBuilder {
  payload: unknown[] | null = null;

  upsert(payload: unknown[]) {
    this.payload = payload;
    return this;
  }

  async select() {
    return { data: this.payload, error: null };
  }
}

describe("SupabaseRepository", () => {
  it("returns an existing group membership instead of overwriting role or joinedAt", async () => {
    const client = {
      from(tableName: string) {
        expect(tableName).toBe("group_members");
        return new GroupMemberSelectBuilder(existingMembershipRow);
      }
    };

    const repo = new SupabaseRepository(client);

    await expect(
      repo.addGroupMember({
        groupId: "group-1",
        userId: "user-1",
        role: "member",
        joinedAt: "2026-05-08T13:00:00.000Z"
      })
    ).resolves.toEqual({
      groupId: "group-1",
      userId: "user-1",
      role: "owner",
      joinedAt: "2026-05-08T12:00:00.000Z"
    });
  });

  it("recovers by reading existing membership when insert loses a duplicate race", async () => {
    let calls = 0;
    const client = {
      from(tableName: string) {
        expect(tableName).toBe("group_members");
        calls += 1;
        if (calls === 1) return new GroupMemberSelectBuilder(null);
        if (calls === 2) return new DuplicateInsertBuilder();
        return new GroupMemberSelectBuilder(existingMembershipRow);
      }
    };

    const repo = new SupabaseRepository(client);

    await expect(
      repo.addGroupMember({
        groupId: "group-1",
        userId: "user-1",
        role: "member",
        joinedAt: "2026-05-08T13:00:00.000Z"
      })
    ).resolves.toEqual({
      groupId: "group-1",
      userId: "user-1",
      role: "owner",
      joinedAt: "2026-05-08T12:00:00.000Z"
    });
    expect(calls).toBe(3);
  });

  it("dedupes duplicate usage rows before upserting with the last row winning", async () => {
    const usageBuilder = new UsageDailyUpsertBuilder();
    const client = {
      from(tableName: string) {
        expect(tableName).toBe("usage_daily");
        return usageBuilder;
      }
    };
    const repo = new SupabaseRepository(client);

    const result = await repo.upsertUsageDaily(
      "user-1",
      [
        {
          usageDate: "2026-05-08",
          source: "codex-jsonl",
          totalTokens: 100,
          inputTokens: 30,
          cachedInputTokens: 10,
          outputTokens: 40,
          reasoningOutputTokens: 20,
          responseCount: 2
        },
        {
          usageDate: "2026-05-08",
          source: "codex-jsonl",
          totalTokens: 150,
          inputTokens: 50,
          cachedInputTokens: 15,
          outputTokens: 60,
          reasoningOutputTokens: 25,
          responseCount: 3
        }
      ],
      "2026-05-08T12:00:00.000Z"
    );

    expect(usageBuilder.payload).toEqual([
      {
        user_id: "user-1",
        usage_date: "2026-05-08",
        source: "codex-jsonl",
        total_tokens: 150,
        input_tokens: 50,
        cached_input_tokens: 15,
        output_tokens: 60,
        reasoning_output_tokens: 25,
        response_count: 3,
        updated_at: "2026-05-08T12:00:00.000Z"
      }
    ]);
    expect(result).toEqual([
      {
        userId: "user-1",
        usageDate: "2026-05-08",
        source: "codex-jsonl",
        totalTokens: 150,
        inputTokens: 50,
        cachedInputTokens: 15,
        outputTokens: 60,
        reasoningOutputTokens: 25,
        responseCount: 3,
        updatedAt: "2026-05-08T12:00:00.000Z"
      }
    ]);
  });
});
