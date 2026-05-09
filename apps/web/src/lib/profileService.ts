import type { AppRepository } from "./repository";
import type { Profile, UserId } from "./types";

export function fallbackProfile(userId: UserId): Profile {
  return {
    id: userId,
    displayName: `Codex user ${userId.slice(0, 8)}`,
    avatarUrl: null,
    hideExactTotals: false
  };
}

export async function ensureProfile(repo: AppRepository, userId: UserId) {
  const existing = await repo.getProfile(userId);
  if (existing) {
    return existing;
  }

  return repo.upsertProfile(fallbackProfile(userId));
}
