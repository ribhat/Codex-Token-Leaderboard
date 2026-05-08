# Codex Token Leaderboard

Privacy-first friend leaderboard for local Codex token usage.

The collector reads local Codex session JSONL records, extracts only daily token totals, and syncs aggregate rows to the dashboard. It must not upload prompts, titles, local paths, repository paths, session IDs, or conversation text.

## Workspaces

- `apps/web`: Next.js dashboard and API routes.
- `packages/db`: Supabase SQL migrations.
- `collector`: Go CLI collector.

## Local Checks

```powershell
npm.cmd run test:web
cd collector
go test ./...
```

## Web Environment

`apps/web` expects these variables when running against Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `TOKEN_HASH_SECRET`
