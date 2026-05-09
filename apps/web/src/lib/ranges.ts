import type { LeaderboardRange } from "./types";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

export function getRangeBounds(range: LeaderboardRange, nowIso: string): { startDate: string | null; endDate: string | null } {
  const now = new Date(nowIso);
  const today = toDateKey(now);

  if (range === "all") {
    return { startDate: null, endDate: null };
  }

  if (range === "today") {
    return { startDate: today, endDate: today };
  }

  if (range === "week") {
    return { startDate: toDateKey(startOfUtcWeek(now)), endDate: today };
  }

  if (range === "month") {
    return { startDate: `${today.slice(0, 8)}01`, endDate: today };
  }

  return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
}
