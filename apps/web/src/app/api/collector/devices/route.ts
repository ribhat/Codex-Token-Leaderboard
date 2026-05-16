import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { createCollectorDevice } from "@/lib/collectorService";
import { createSupabaseServiceClient, getUserIdFromRequest } from "@/lib/auth";
import { invalidRequestBodyResponse, parseJsonObject } from "@/lib/requestBody";
import { SupabaseRepository } from "@/lib/supabaseRepository";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await parseJsonObject(request);
    if (!body) {
      return invalidRequestBodyResponse();
    }
    if (typeof body.platform !== "string") {
      return NextResponse.json({ error: "Platform is required" }, { status: 400 });
    }
    if (body.deviceLabel !== undefined && body.deviceLabel !== null && typeof body.deviceLabel !== "string") {
      return invalidRequestBodyResponse();
    }

    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await createCollectorDevice({
      repo,
      userId,
      platform: body.platform,
      deviceLabel: body.deviceLabel ?? null,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
