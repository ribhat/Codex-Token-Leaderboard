import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { createSupabaseServiceClient, getUserIdFromRequest } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboardService";
import { SupabaseRepository } from "@/lib/supabaseRepository";
import type { LeaderboardRange } from "@/lib/types";

const RANGES = new Set<LeaderboardRange>(["today", "week", "month", "year", "all"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isLeaderboardRange(value: string): value is LeaderboardRange {
  return RANGES.has(value as LeaderboardRange);
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const viewerId = await getUserIdFromRequest(request);
    const range = new URL(request.url).searchParams.get("range") ?? "today";
    if (!isLeaderboardRange(range)) {
      return NextResponse.json({ error: "Invalid leaderboard range" }, { status: 400 });
    }

    const { id } = await params;
    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await getLeaderboard({
      repo,
      viewerId,
      groupId: id,
      range,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
