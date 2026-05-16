import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { createSupabaseServiceClient, getUserIdFromRequest } from "@/lib/auth";
import { joinGroup } from "@/lib/groupService";
import { invalidRequestBodyResponse, parseJsonObject } from "@/lib/requestBody";
import { SupabaseRepository } from "@/lib/supabaseRepository";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await parseJsonObject(request);
    if (!body) {
      return invalidRequestBodyResponse();
    }
    if (typeof body.inviteCode !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await joinGroup({
      repo,
      userId,
      inviteCode: body.inviteCode,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
