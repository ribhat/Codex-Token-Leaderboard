import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";
import { syncUsage } from "@/lib/collectorService";
import { createSupabaseServiceClient } from "@/lib/auth";
import { SupabaseRepository } from "@/lib/supabaseRepository";

const BEARER_PREFIX = "Bearer ";

async function readJsonBody(request: Request) {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? body : { rows: undefined };
  } catch {
    return { rows: undefined };
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return "";
  }

  return authorization.slice(BEARER_PREFIX.length).trim();
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await syncUsage({
      repo,
      bearerToken: getBearerToken(request),
      rows: "rows" in body ? body.rows : undefined,
      now: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, { collectorAuth: true });
  }
}
