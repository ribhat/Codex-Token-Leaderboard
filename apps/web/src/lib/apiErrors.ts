import { NextResponse } from "next/server";

const AUTHENTICATION_ERROR = "Authentication is required";

export function apiErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: message === AUTHENTICATION_ERROR ? 401 : 400 });
}
