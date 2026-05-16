import { NextResponse } from "next/server";

export type JsonObject = Record<string, unknown>;

export function invalidRequestBodyResponse() {
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

export async function parseJsonObject(request: Request): Promise<JsonObject | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as JsonObject;
  } catch {
    return null;
  }
}
