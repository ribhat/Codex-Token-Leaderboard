import { createClient, type Session } from "@supabase/supabase-js";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase browser auth environment is not configured");
  }

  return createClient(url, key);
}

export function displayNameFromSession(session: Session | null) {
  const metadata = session?.user.user_metadata;
  const name =
    typeof metadata?.name === "string"
      ? metadata.name
      : typeof metadata?.user_name === "string"
        ? metadata.user_name
        : typeof metadata?.preferred_username === "string"
          ? metadata.preferred_username
          : null;

  return name?.trim() || session?.user.email || "Signed in";
}
