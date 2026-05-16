import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { createGroup, listGroups } from "@/lib/groupService";
import { createSupabaseServiceClient, getUserIdFromRequest } from "@/lib/auth";
import { invalidRequestBodyResponse, parseJsonObject } from "@/lib/requestBody";
import { SupabaseRepository } from "@/lib/supabaseRepository";

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await listGroups({ repo, userId });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await parseJsonObject(request);
    if (!body) {
      return invalidRequestBodyResponse();
    }
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }
    if (body.timezone !== undefined && typeof body.timezone !== "string") {
      return invalidRequestBodyResponse();
    }

    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await createGroup({
      repo,
      userId,
      name: body.name,
      timezone: body.timezone,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
