# Codex Token Leaderboard

Privacy-first friend leaderboard for local Codex token usage.

The collector reads local Codex session JSONL records, extracts only daily token totals, and syncs aggregate rows to the dashboard. It must not upload prompts, titles, local paths, repository paths, session IDs, or conversation text.

## Workspaces

- `apps/web`: Next.js dashboard and API routes.
- `packages/db`: Supabase SQL migrations.
- `collector`: Go CLI collector.

## Local Setup

```powershell
npm.cmd install
```

The web app can run and test without a live Supabase project for most local development. Authenticated API routes need Supabase environment variables.

## Web Environment

Set these for `apps/web` when running against Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Apply `packages/db/migrations/0001_initial.sql` to the Supabase project before using the hosted dashboard.

## Run Web

```powershell
npm.cmd run dev --workspace apps/web
```

The dashboard opens at the local URL printed by Next.js, usually `http://localhost:3000`.

## Run Collector Preview

The collector requires Go 1.23 or newer.

```powershell
cd collector
go run . preview
```

To preview against the included privacy fixture:

```powershell
cd collector
go run . preview --sessions .\internal\codex\testdata
```

## Sync Flow

1. Sign in to the dashboard with GitHub.
2. Create or join a group.
3. Generate a collector token from the dashboard.
4. Run `codex-tokens login --server <url> --token <device_token>`.
5. Run `codex-tokens preview` to inspect local daily aggregate rows.
6. Run `codex-tokens sync` to upload only those daily aggregates.

During local development, `go run . login --server <url> --token <device_token>`, `go run . preview`, and `go run . sync` exercise the same commands without building a binary first.

## Local Checks

```powershell
npm.cmd run test:web
npm.cmd run build --workspace apps/web
cd collector
go test ./...
```

## Privacy Boundary

Uploaded usage rows contain only `usage_date`, `source`, `total_tokens`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, and `response_count`.

Device tokens are returned once by the dashboard, stored locally by the collector, and stored in the database only as hashes. Exact leaderboard totals can be masked per profile while preserving rank.
