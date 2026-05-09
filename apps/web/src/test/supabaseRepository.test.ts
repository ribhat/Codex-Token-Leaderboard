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
});
