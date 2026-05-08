# Database

Supabase SQL migrations for Codex Token Leaderboard.

Apply `migrations/0001_initial.sql` to a Supabase project before running the production dashboard. The web API uses service-role access for collector sync and dashboard service modules enforce membership checks before returning leaderboard data.

`usage_daily` is keyed by `(user_id, usage_date, source)` so collector sync is idempotent.
