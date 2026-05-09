import { NextResponse } from "next/server";
import { createSupabaseServiceClient, getUserIdFromRequest } from "@/lib/auth";
import { joinGroup } from "@/lib/groupService";
import { SupabaseRepository } from "@/lib/supabaseRepository";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await request.json();
    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await joinGroup({
      repo,
      userId,
      inviteCode: body.inviteCode,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
