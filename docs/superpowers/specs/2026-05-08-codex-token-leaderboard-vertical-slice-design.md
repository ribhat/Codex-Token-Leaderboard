# Codex Token Leaderboard Vertical Slice Design

## Overview

Build the first end-to-end slice of a privacy-first friend leaderboard for Codex token usage. The slice proves the core loop: a local collector reads Codex session usage records, aggregates daily token totals, syncs only those aggregates, and a web dashboard ranks group members from the stored totals.

The implementation uses a monorepo with `apps/web` for the Next.js dashboard and API routes, `packages/db` for Supabase migrations, and `collector` for the Go CLI. The code should be deployable-shaped for Supabase and Vercel, while tests avoid requiring a live Supabase project.

## Goals

- Scaffold the monorepo for the web app, database package, and Go collector.
- Implement the vertical MVP path from local JSONL extraction to leaderboard display.
- Preserve the privacy boundary by uploading daily aggregate totals only.
- Use real Supabase-shaped auth, database, and API boundaries without requiring hosted infrastructure during tests.
- Cover privacy-critical and ranking behavior with automated tests.

## Non-Goals

- SQLite fallback from `~/.codex/state_5.sqlite`.
- Windows Task Scheduler install and uninstall.
- macOS LaunchAgent install and uninstall.
- Full personal analytics page with detailed trend charts.
- Generated Supabase database types.
- Production deployment guide beyond the environment variables needed to run the app.

## Architecture

The monorepo has three primary workspaces:

- `apps/web`: Next.js and TypeScript dashboard, Supabase Auth wiring, API routes, group management, collector device creation, and leaderboard UI.
- `packages/db`: SQL migrations for Supabase tables, indexes, constraints, and row-level-security-friendly structure.
- `collector`: Go CLI for `login`, `preview`, `sync`, and `status`.

The dashboard is responsible for authenticated human workflows. The collector uses a device token, not a browser session, and can only sync aggregate usage for its owning user. API logic should be factored into small service modules so tests can exercise authorization, upsert, and ranking behavior without a live Supabase instance.

## Vertical Slice Scope

Included in this slice:

- Supabase SQL migrations for `profiles`, `groups`, `group_members`, `collector_devices`, `usage_daily`, and `sync_events`.
- GitHub login wiring through Supabase Auth in the dashboard.
- Basic group creation, invite-code join, and current group display.
- Collector device token creation from the dashboard.
- Collector `login --server <url> --token <device_token>`.
- Collector `preview` to print local daily aggregates without syncing.
- Collector `sync` to upload daily aggregates.
- Collector `status` to show configured server, token presence, and recent local aggregate availability.
- Codex JSONL extraction from `~/.codex/sessions/**/*.jsonl`.
- Leaderboard ranges: `today`, `week`, `month`, `year`, and `all`.
- Masked exact totals for users with `profiles.hide_exact_totals = true`.
- Stale sync warning when a member has no device seen within the last 24 hours.

Deferred from this slice:

- Local SQLite fallback.
- Scheduled sync installation.
- Rich personal trend page.
- Multiple named devices management UI beyond creating one token.
- Linux support.

## Data Model

`profiles`

- `id uuid primary key references auth.users(id)`
- `display_name text`
- `avatar_url text`
- `hide_exact_totals boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`groups`

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `creator_id uuid not null references profiles(id)`
- `invite_code_hash text not null unique`
- `timezone text not null default 'UTC'`
- `created_at timestamptz not null default now()`

`group_members`

- `group_id uuid not null references groups(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `role text not null default 'member'`
- `joined_at timestamptz not null default now()`
- Primary key: `(group_id, user_id)`

`collector_devices`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `token_hash text not null unique`
- `platform text not null`
- `device_label text`
- `last_seen_at timestamptz`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`

`usage_daily`

- `user_id uuid not null references profiles(id) on delete cascade`
- `usage_date date not null`
- `source text not null default 'codex-jsonl'`
- `total_tokens bigint not null default 0`
- `input_tokens bigint not null default 0`
- `cached_input_tokens bigint not null default 0`
- `output_tokens bigint not null default 0`
- `reasoning_output_tokens bigint not null default 0`
- `response_count integer not null default 0`
- `updated_at timestamptz not null default now()`
- Primary key: `(user_id, usage_date, source)`

`sync_events`

- `id uuid primary key default gen_random_uuid()`
- `device_id uuid references collector_devices(id) on delete set null`
- `user_id uuid references profiles(id) on delete set null`
- `success boolean not null`
- `message text`
- `days_synced integer not null default 0`
- `created_at timestamptz not null default now()`

## API Contract

`POST /api/groups`

- Dashboard-authenticated route.
- Accepts `{ "name": string, "timezone"?: string }`.
- Creates a group, creates creator membership, stores a hash of a generated invite code, and returns the group plus the plaintext invite code once.

`POST /api/groups/join`

- Dashboard-authenticated route.
- Accepts `{ "inviteCode": string }`.
- Hashes the invite code, finds the group, and inserts membership idempotently.

`GET /api/groups/:id/leaderboard?range=today|week|month|year|all`

- Dashboard-authenticated route.
- Requires the viewer to be a member of the group.
- Returns ranked group members, total tokens for the selected range, masked total state, last synced time, and stale sync state.

`POST /api/collector/devices`

- Dashboard-authenticated route.
- Accepts `{ "platform": string, "deviceLabel"?: string }`.
- Generates a high-entropy device token, stores only its hash, and returns the plaintext token once.

`POST /api/collector/sync`

- Collector route using `Authorization: Bearer <device_token>`.
- Rejects missing, invalid, or revoked tokens.
- Accepts daily aggregate rows only.
- Upserts by `(user_id, usage_date, source)` to avoid double counting repeated syncs.
- Updates `collector_devices.last_seen_at`.
- Writes a `sync_events` row for success or failure.

## Collector Design

The Go collector should keep its internal boundaries small:

- `config`: reads and writes server URL plus device token in a local config file.
- `codex`: discovers `~/.codex/sessions/**/*.jsonl` and parses usage events.
- `aggregate`: converts usage events into daily totals.
- `sync`: posts aggregates to the web API.
- `cmd`: CLI commands and user-facing output.

For JSONL extraction, the collector reads only the timestamp and `payload.info.last_token_usage`. It must ignore any fields that may contain prompts, thread text, file paths, repository paths, titles, session IDs, or raw conversation content.

The first slice supports these commands:

- `codex-tokens login --server <url> --token <device_token>`
- `codex-tokens preview`
- `codex-tokens sync`
- `codex-tokens status`

`preview` prints the same aggregate rows that `sync` would upload, including `usage_date`, `total_tokens`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, and `response_count`.

## Dashboard Design

The first dashboard screen should be a functional application screen, not a marketing page. After login, the user sees:

- Profile identity from Supabase Auth.
- Group creation and invite join controls.
- Current group selector if the user belongs to multiple groups.
- Leaderboard tabs for Today, Week, Month, Year, and All Time.
- Member rows with rank, display name, visible token state, last synced time, and stale warning.
- Collector setup area that can generate a token and show the `codex-tokens login` command.

The visual style should be quiet and operational: dense enough to scan, restrained colors, predictable layout, and no decorative hero treatment.

## Privacy Rules

- The collector uploads daily aggregate totals only.
- The collector must not upload prompts, titles, local paths, repository paths, session IDs, or conversation text.
- Device tokens are shown once and stored only as hashes.
- Exact totals are visible only to members of the same group.
- If `hide_exact_totals` is enabled, leaderboard ranking still uses real totals, but the returned row masks the numeric total.
- Usage is global per user, so joining multiple groups shares the same aggregate usage with each group.

## Testing Strategy

Collector tests:

- JSONL usage events are parsed from `payload.info.last_token_usage`.
- Prompt-like and path-like fields in fixture JSONL are ignored and never appear in aggregate outputs.
- Daily totals aggregate input, cached input, output, reasoning output, total tokens, and response count correctly.
- Missing Codex session directory returns a clear setup error.

API/service tests:

- Collector sync rejects missing, invalid, and revoked device tokens.
- Daily usage upsert is idempotent for repeated sync payloads.
- Group leaderboard rejects viewers who are not group members.
- Today, week, month, year, and all-time ranges produce expected rankings.
- Masked-total users return rank and masked state without exact totals.
- Stale sync warning appears when no active device was seen in the last 24 hours.

UI tests:

- A signed-in user can reach the dashboard shell.
- A user can create a group and see it selected.
- A user can join a group by invite code.
- Leaderboard tabs request the expected range.
- Masked totals and stale warnings render from API data.

## Success Criteria

- A developer can run the web app locally with Supabase environment variables configured.
- A developer can run collector tests and API/UI tests without a hosted Supabase project.
- `codex-tokens preview` produces daily aggregate rows from JSONL fixtures or local Codex session files.
- `codex-tokens sync` sends only aggregate rows to `/api/collector/sync`.
- Re-running `sync` for the same day updates the same `usage_daily` row instead of adding duplicate usage.
- A group member can view ranked leaderboard rows for all supported ranges.
- The codebase has clear extension points for SQLite fallback and scheduled sync install commands.
