import { createClient } from "@supabase/supabase-js";

const BEARER_PREFIX = "Bearer ";

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service environment is not configured");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getUserIdFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    throw new Error("Authentication is required");
  }

  const jwt = authorization.slice(BEARER_PREFIX.length).trim();
  if (!jwt) {
    throw new Error("Authentication is required");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase auth environment is not configured");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `${BEARER_PREFIX}${jwt}` } }
  });
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Authentication is required");
  }

  return data.user.id;
}
