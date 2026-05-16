import { NextResponse } from "next/server";

const AUTHENTICATION_ERROR = "Authentication is required";
const INTERNAL_ERROR = "Internal server error";

const KNOWN_BAD_REQUEST_MESSAGES = new Set([
  "Group name is required",
  "Profile is required",
  "Invite code is required",
  "Invite code is invalid",
  "Platform is required",
  "Collector token is required",
  "Invalid usage payload",
  "Group not found",
  "Invalid leaderboard range"
]);

const COLLECTOR_UNAUTHORIZED_MESSAGES = new Set(["Collector token is required", "Collector token is invalid"]);
const COLLECTOR_FORBIDDEN_MESSAGES = new Set(["Collector token is revoked"]);

export function apiErrorResponse(error: unknown, options?: { collectorAuth?: boolean }) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message === AUTHENTICATION_ERROR || (options?.collectorAuth && COLLECTOR_UNAUTHORIZED_MESSAGES.has(message))) {
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (options?.collectorAuth && COLLECTOR_FORBIDDEN_MESSAGES.has(message)) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (KNOWN_BAD_REQUEST_MESSAGES.has(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 });
}
