# Codex Token Leaderboard Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end privacy-first token leaderboard path from local Codex JSONL aggregation to a group leaderboard.

**Architecture:** The repo is a monorepo with a Next.js web app in `apps/web`, Supabase SQL migrations in `packages/db`, and a Go CLI collector in `collector`. The web app uses small service modules behind API routes so behavior can be tested without a live Supabase project, while the collector has separate config, Codex extraction, aggregation, and sync packages.

**Tech Stack:** Next.js, TypeScript, React, Vitest, Testing Library, Supabase JS, PostgreSQL SQL migrations, Go standard library, Cobra CLI.

---

## File Structure

Create these repo-level files:

- `package.json`: npm workspaces, shared scripts for web tests and linting.
- `README.md`: local setup, env vars, collector workflow, privacy note.
- `.gitignore`: Node, Next.js, Go, local env, and `.superpowers/` ignores.
- `docs/superpowers/plans/2026-05-08-codex-token-leaderboard-vertical-slice.md`: this plan.

Create these database files:

- `packages/db/package.json`: package metadata and migration validation script.
- `packages/db/migrations/0001_initial.sql`: Supabase schema, constraints, indexes, and RLS enablement.
- `packages/db/README.md`: migration usage and table notes.

Create these web files:

- `apps/web/package.json`: Next.js app dependencies and scripts.
- `apps/web/next-env.d.ts`: Next.js generated environment types.
- `apps/web/next.config.ts`: Next.js config.
- `apps/web/tsconfig.json`: TypeScript config.
- `apps/web/vitest.config.ts`: Vitest config.
- `apps/web/src/app/layout.tsx`: root HTML layout.
- `apps/web/src/app/page.tsx`: Task 1 scaffold page; Task 8 replaces it with the dashboard shell.
- `apps/web/src/app/globals.css`: application styles.
- `apps/web/src/app/api/groups/route.ts`: `POST /api/groups`.
- `apps/web/src/app/api/groups/join/route.ts`: `POST /api/groups/join`.
- `apps/web/src/app/api/groups/[id]/leaderboard/route.ts`: leaderboard API.
- `apps/web/src/app/api/collector/devices/route.ts`: device token creation API.
- `apps/web/src/app/api/collector/sync/route.ts`: collector sync API.
- `apps/web/src/lib/auth.ts`: Supabase server auth helpers.
- `apps/web/src/lib/crypto.ts`: token generation and hashing helpers.
- `apps/web/src/lib/types.ts`: shared service types.
- `apps/web/src/lib/ranges.ts`: leaderboard range date calculations.
- `apps/web/src/lib/repository.ts`: repository interface used by services.
- `apps/web/src/lib/supabaseRepository.ts`: Supabase-backed repository.
- `apps/web/src/lib/memoryRepository.ts`: test repository implementation.
- `apps/web/src/lib/groupService.ts`: group create/join logic.
- `apps/web/src/lib/collectorService.ts`: device token and sync logic.
- `apps/web/src/lib/leaderboardService.ts`: ranking logic.
- `apps/web/src/components/Dashboard.tsx`: signed-in dashboard shell.
- `apps/web/src/components/Leaderboard.tsx`: tabs and member rows.
- `apps/web/src/components/CollectorSetup.tsx`: token creation and command display.
- `apps/web/src/test/groupService.test.ts`: group service tests.
- `apps/web/src/test/collectorService.test.ts`: collector service tests.
- `apps/web/src/test/leaderboardService.test.ts`: range, masking, and stale tests.
- `apps/web/src/test/page.test.tsx`: Task 1 scaffold smoke test.
- `apps/web/src/test/Dashboard.test.tsx`: basic UI tests.
- `apps/web/src/test/testData.ts`: reusable fixtures.

Create these collector files:

- `collector/go.mod`: Go module metadata.
- `collector/main.go`: Task 1 stdlib-only CLI placeholder; Task 10 wires it to Cobra commands.
- `collector/internal/config/config.go`: local config read/write.
- `collector/internal/codex/events.go`: JSONL event parser.
- `collector/internal/codex/discover.go`: Codex session discovery.
- `collector/internal/aggregate/aggregate.go`: daily aggregation.
- `collector/internal/sync/client.go`: API client.
- `collector/internal/cmd/root.go`: Cobra root command.
- `collector/internal/cmd/login.go`: login command.
- `collector/internal/cmd/preview.go`: preview command.
- `collector/internal/cmd/sync.go`: sync command.
- `collector/internal/cmd/status.go`: status command.
- `collector/internal/codex/testdata/session.jsonl`: privacy-focused fixture.
- `collector/internal/codex/events_test.go`: JSONL parsing tests.
- `collector/internal/aggregate/aggregate_test.go`: daily aggregation tests.
- `collector/internal/config/config_test.go`: config tests.
- `collector/internal/sync/client_test.go`: sync payload tests.

---

### Task 1: Repository Scaffold

**Files:**

- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/web/package.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/test/page.test.tsx`
- Create: `collector/go.mod`
- Create: `collector/main.go`

- [ ] **Step 1: Create root workspace files**

Write `package.json`:

```json
{
  "name": "codex-token-leaderboard",
  "private": true,
  "workspaces": [
    "apps/web",
    "packages/db"
  ],
  "scripts": {
    "test": "npm.cmd run test --workspace apps/web",
    "test:web": "npm.cmd run test --workspace apps/web",
    "lint:web": "npm.cmd run lint --workspace apps/web",
    "test:collector": "cd collector && go test ./..."
  }
}
```

Write `.gitignore`:

```gitignore
node_modules/
.next/
out/
coverage/
.env
.env.local
.env.*.local
dist/
bin/
*.exe
*.test
.worktrees/
.superpowers/
```

Write `README.md`:

```markdown
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
```

- [ ] **Step 2: Create the web app shell files**

Write `apps/web/package.json`:

```json
{
  "name": "@codex-token-leaderboard/web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "tsc --noEmit --incremental false",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "latest",
    "lucide-react": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "jsdom": "latest"
  }
}
```

Write `apps/web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

Write `apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Write `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Write `apps/web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Write `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Write `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Token Leaderboard",
  description: "Privacy-first friend leaderboard for Codex token usage"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Write `apps/web/src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Codex Token Leaderboard</h1>
      <p>Privacy-first friend leaderboard for local Codex token usage.</p>
    </main>
  );
}
```

Write `apps/web/src/test/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("HomePage", () => {
  it("renders the scaffold title", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Codex Token Leaderboard" })).toBeInTheDocument();
  });
});
```

Write `apps/web/src/app/globals.css`:

```css
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --panel: #ffffff;
  --panel-border: #d9dee7;
  --text: #17202a;
  --muted: #637083;
  --accent: #1f7a6d;
  --accent-strong: #12584f;
  --warning: #a05a00;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--text);
  border-radius: 6px;
  min-height: 36px;
  padding: 0 12px;
  cursor: pointer;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

button.primary:hover {
  background: var(--accent-strong);
}

input,
select {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  min-height: 36px;
  padding: 0 10px;
  background: #ffffff;
}
```

- [ ] **Step 3: Create the collector module shell**

Write `collector/go.mod`:

```go
module github.com/codex-token-leaderboard/collector

go 1.23

require github.com/spf13/cobra v1.8.1
```

Write `collector/main.go`:

```go
package main

import "fmt"

func main() {
	fmt.Println("codex-token-leaderboard collector scaffold")
}
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm.cmd install
cd collector
go mod tidy
```

Expected: dependency installation succeeds and creates `package-lock.json` plus `collector/go.sum`.

Note: `collector/main.go` remains stdlib-only in Task 1 so the repository compiles before `collector/internal/cmd` exists. Task 10 introduces Cobra command imports and may refresh `collector/go.sum`.

- [ ] **Step 5: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json .gitignore README.md apps/web collector
git commit -m "chore: scaffold monorepo"
```

---

### Task 2: Database Migration

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/migrations/0001_initial.sql`
- Create: `packages/db/README.md`

- [ ] **Step 1: Write the migration file**

Write `packages/db/migrations/0001_initial.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  hide_exact_totals boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  invite_code_hash text not null unique,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.collector_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  platform text not null check (char_length(platform) between 1 and 64),
  device_label text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  source text not null default 'codex-jsonl',
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  reasoning_output_tokens bigint not null default 0 check (reasoning_output_tokens >= 0),
  response_count integer not null default 0 check (response_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, source)
);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.collector_devices(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  success boolean not null,
  message text,
  days_synced integer not null default 0 check (days_synced >= 0),
  created_at timestamptz not null default now()
);

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists collector_devices_user_id_idx on public.collector_devices(user_id);
create index if not exists usage_daily_date_idx on public.usage_daily(usage_date);
create index if not exists sync_events_user_created_idx on public.sync_events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.collector_devices enable row level security;
alter table public.usage_daily enable row level security;
alter table public.sync_events enable row level security;
```

- [ ] **Step 2: Add db package metadata and docs**

Write `packages/db/package.json`:

```json
{
  "name": "@codex-token-leaderboard/db",
  "private": true,
  "scripts": {
    "check": "node -e \"const fs=require('fs');fs.accessSync('migrations/0001_initial.sql')\""
  }
}
```

Write `packages/db/README.md`:

```markdown
# Database

Supabase SQL migrations for Codex Token Leaderboard.

Apply `migrations/0001_initial.sql` to a Supabase project before running the production dashboard. The web API uses service-role access for collector sync and dashboard service modules enforce membership checks before returning leaderboard data.

`usage_daily` is keyed by `(user_id, usage_date, source)` so collector sync is idempotent.
```

- [ ] **Step 3: Validate migration file exists**

Run:

```powershell
npm.cmd run check --workspace packages/db
```

Expected: command exits with status 0.

- [ ] **Step 4: Commit database migration**

Run:

```powershell
git add packages/db
git commit -m "feat: add initial database migration"
```

---

### Task 3: Web Service Types And Test Repository

**Files:**

- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/repository.ts`
- Create: `apps/web/src/lib/memoryRepository.ts`
- Create: `apps/web/src/test/testData.ts`

- [ ] **Step 1: Write shared types**

Write `apps/web/src/lib/types.ts`:

```ts
export type UserId = string;
export type GroupId = string;
export type DeviceId = string;

export type Profile = {
  id: UserId;
  displayName: string;
  avatarUrl: string | null;
  hideExactTotals: boolean;
};

export type Group = {
  id: GroupId;
  name: string;
  creatorId: UserId;
  inviteCodeHash: string;
  timezone: string;
  createdAt: string;
};

export type GroupMember = {
  groupId: GroupId;
  userId: UserId;
  role: "owner" | "member";
  joinedAt: string;
};

export type CollectorDevice = {
  id: DeviceId;
  userId: UserId;
  tokenHash: string;
  platform: string;
  deviceLabel: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type UsageDaily = {
  userId: UserId;
  usageDate: string;
  source: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  responseCount: number;
  updatedAt: string;
};

export type SyncEvent = {
  id: string;
  deviceId: DeviceId | null;
  userId: UserId | null;
  success: boolean;
  message: string | null;
  daysSynced: number;
  createdAt: string;
};

export type UsageAggregateInput = {
  usageDate: string;
  source?: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  responseCount: number;
};

export type LeaderboardRange = "today" | "week" | "month" | "year" | "all";
```

- [ ] **Step 2: Write repository interface**

Write `apps/web/src/lib/repository.ts`:

```ts
import type {
  CollectorDevice,
  Group,
  GroupId,
  GroupMember,
  Profile,
  SyncEvent,
  UsageAggregateInput,
  UsageDaily,
  UserId
} from "./types";

export type CreateGroupInput = {
  name: string;
  creatorId: UserId;
  inviteCodeHash: string;
  timezone: string;
  now: string;
};

export type CreateDeviceInput = {
  userId: UserId;
  tokenHash: string;
  platform: string;
  deviceLabel: string | null;
  now: string;
};

export type AppRepository = {
  getProfile(userId: UserId): Promise<Profile | null>;
  upsertProfile(profile: Profile): Promise<Profile>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  getGroup(groupId: GroupId): Promise<Group | null>;
  getGroupByInviteHash(inviteCodeHash: string): Promise<Group | null>;
  addGroupMember(member: GroupMember): Promise<GroupMember>;
  isGroupMember(groupId: GroupId, userId: UserId): Promise<boolean>;
  listGroupMembers(groupId: GroupId): Promise<Array<GroupMember & { profile: Profile }>>;
  createCollectorDevice(input: CreateDeviceInput): Promise<CollectorDevice>;
  getCollectorDeviceByTokenHash(tokenHash: string): Promise<CollectorDevice | null>;
  updateCollectorDeviceSeen(deviceId: string, seenAt: string): Promise<void>;
  upsertUsageDaily(userId: UserId, rows: UsageAggregateInput[], now: string): Promise<UsageDaily[]>;
  listUsageForUsers(userIds: UserId[], startDate: string | null, endDate: string | null): Promise<UsageDaily[]>;
  getLatestDeviceSeenByUser(userIds: UserId[]): Promise<Map<UserId, string | null>>;
  createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }): Promise<SyncEvent>;
};
```

- [ ] **Step 3: Write in-memory repository**

Write `apps/web/src/lib/memoryRepository.ts`:

```ts
import type { AppRepository, CreateDeviceInput, CreateGroupInput } from "./repository";
import type {
  CollectorDevice,
  Group,
  GroupMember,
  Profile,
  SyncEvent,
  UsageAggregateInput,
  UsageDaily,
  UserId
} from "./types";

let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export class MemoryRepository implements AppRepository {
  profiles = new Map<string, Profile>();
  groups = new Map<string, Group>();
  members = new Map<string, GroupMember>();
  devices = new Map<string, CollectorDevice>();
  usage = new Map<string, UsageDaily>();
  syncEvents: SyncEvent[] = [];

  async getProfile(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async upsertProfile(profile: Profile) {
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async createGroup(input: CreateGroupInput) {
    const group: Group = {
      id: nextId("group"),
      name: input.name,
      creatorId: input.creatorId,
      inviteCodeHash: input.inviteCodeHash,
      timezone: input.timezone,
      createdAt: input.now
    };
    this.groups.set(group.id, group);
    return group;
  }

  async getGroup(groupId: string) {
    return this.groups.get(groupId) ?? null;
  }

  async getGroupByInviteHash(inviteCodeHash: string) {
    return Array.from(this.groups.values()).find((group) => group.inviteCodeHash === inviteCodeHash) ?? null;
  }

  async addGroupMember(member: GroupMember) {
    const existing = this.members.get(`${member.groupId}:${member.userId}`);
    if (existing) {
      return existing;
    }

    this.members.set(`${member.groupId}:${member.userId}`, member);
    return member;
  }

  async isGroupMember(groupId: string, userId: string) {
    return this.members.has(`${groupId}:${userId}`);
  }

  async listGroupMembers(groupId: string) {
    return Array.from(this.members.values())
      .filter((member) => member.groupId === groupId)
      .map((member) => {
        const profile = this.profiles.get(member.userId);
        if (!profile) {
          throw new Error(`Missing profile for ${member.userId}`);
        }
        return { ...member, profile };
      });
  }

  async createCollectorDevice(input: CreateDeviceInput) {
    const device: CollectorDevice = {
      id: nextId("device"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      platform: input.platform,
      deviceLabel: input.deviceLabel,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: input.now
    };
    this.devices.set(device.id, device);
    return device;
  }

  async getCollectorDeviceByTokenHash(tokenHash: string) {
    return Array.from(this.devices.values()).find((device) => device.tokenHash === tokenHash) ?? null;
  }

  async updateCollectorDeviceSeen(deviceId: string, seenAt: string) {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.set(deviceId, { ...device, lastSeenAt: seenAt });
    }
  }

  async upsertUsageDaily(userId: string, rows: UsageAggregateInput[], now: string) {
    return rows.map((row) => {
      const source = row.source ?? "codex-jsonl";
      const usage: UsageDaily = {
        userId,
        usageDate: row.usageDate,
        source,
        totalTokens: row.totalTokens,
        inputTokens: row.inputTokens,
        cachedInputTokens: row.cachedInputTokens,
        outputTokens: row.outputTokens,
        reasoningOutputTokens: row.reasoningOutputTokens,
        responseCount: row.responseCount,
        updatedAt: now
      };
      this.usage.set(`${userId}:${row.usageDate}:${source}`, usage);
      return usage;
    });
  }

  async listUsageForUsers(userIds: string[], startDate: string | null, endDate: string | null) {
    const userSet = new Set(userIds);
    return Array.from(this.usage.values()).filter((row) => {
      if (!userSet.has(row.userId)) return false;
      if (startDate && row.usageDate < startDate) return false;
      if (endDate && row.usageDate > endDate) return false;
      return true;
    });
  }

  async getLatestDeviceSeenByUser(userIds: UserId[]) {
    const result = new Map<UserId, string | null>();
    for (const userId of userIds) {
      const seen = Array.from(this.devices.values())
        .filter((device) => device.userId === userId && !device.revokedAt)
        .map((device) => device.lastSeenAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
      result.set(userId, seen);
    }
    return result;
  }

  async createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }) {
    const syncEvent: SyncEvent = { id: nextId("sync"), ...event };
    this.syncEvents.push(syncEvent);
    return syncEvent;
  }
}
```

- [ ] **Step 4: Write reusable test data**

Write `apps/web/src/test/testData.ts`:

```ts
import type { Profile } from "@/lib/types";

export const now = "2026-05-08T12:00:00.000Z";

export const ada: Profile = {
  id: "user-ada",
  displayName: "Ada",
  avatarUrl: null,
  hideExactTotals: false
};

export const grace: Profile = {
  id: "user-grace",
  displayName: "Grace",
  avatarUrl: null,
  hideExactTotals: true
};

export const linus: Profile = {
  id: "user-linus",
  displayName: "Linus",
  avatarUrl: null,
  hideExactTotals: false
};
```

- [ ] **Step 5: Run web tests**

Run:

```powershell
npm.cmd run test:web
```

Expected: no tests found or pass, depending on Vitest version. If Vitest exits nonzero because there are no tests, continue after Task 4 adds tests.

- [ ] **Step 6: Commit service foundations**

Run:

```powershell
git add apps/web/src/lib apps/web/src/test
git commit -m "feat: add web service foundation"
```

---

### Task 4: Group Services With Tests

**Files:**

- Create: `apps/web/src/lib/crypto.ts`
- Create: `apps/web/src/lib/groupService.ts`
- Create: `apps/web/src/test/groupService.test.ts`

- [ ] **Step 1: Write failing group service tests**

Write `apps/web/src/test/groupService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createGroup, joinGroup } from "@/lib/groupService";
import { MemoryRepository } from "@/lib/memoryRepository";
import { hashToken } from "@/lib/crypto";
import { ada, grace, now } from "./testData";

describe("groupService", () => {
  it("creates a group with owner membership and a one-time invite code", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);

    const result = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "America/Los_Angeles",
      now,
      inviteCode: "invite-secret"
    });

    expect(result.group.name).toBe("Friday Builders");
    expect(result.inviteCode).toBe("invite-secret");
    await expect(repo.isGroupMember(result.group.id, ada.id)).resolves.toBe(true);
    expect(result.group).not.toHaveProperty("inviteCodeHash");
    await expect(repo.getGroup(result.group.id)).resolves.toMatchObject({
      inviteCodeHash: await hashToken("invite-secret")
    });
  });

  it("joins a group by invite code idempotently", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await repo.upsertProfile(grace);
    const created = await createGroup({
      repo,
      userId: ada.id,
      name: "Friday Builders",
      timezone: "UTC",
      now,
      inviteCode: "invite-secret"
    });

    const firstJoin = await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now });
    const secondJoin = await joinGroup({ repo, userId: grace.id, inviteCode: "invite-secret", now });

    expect(firstJoin.group.id).toBe(created.group.id);
    expect(secondJoin.group.id).toBe(created.group.id);
    const members = await repo.listGroupMembers(created.group.id);
    expect(members.map((member) => member.userId).sort()).toEqual([ada.id, grace.id].sort());
  });

  it("rejects an invalid invite code", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(grace);

    await expect(joinGroup({ repo, userId: grace.id, inviteCode: "missing", now })).rejects.toThrow("Invite code is invalid");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd run test:web -- src/test/groupService.test.ts
```

Expected: FAIL because `@/lib/groupService` and `@/lib/crypto` do not exist.

- [ ] **Step 3: Implement crypto helpers**

Write `apps/web/src/lib/crypto.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function tokenMatches(token: string, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(await hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Implement group service**

Write `apps/web/src/lib/groupService.ts`:

```ts
import { generateToken, hashToken } from "./crypto";
import type { AppRepository } from "./repository";
import type { Group, UserId } from "./types";

export type PublicGroup = Omit<Group, "inviteCodeHash">;

type CreateGroupArgs = {
  repo: AppRepository;
  userId: UserId;
  name: string;
  timezone?: string;
  now: string;
  inviteCode?: string;
};

type JoinGroupArgs = {
  repo: AppRepository;
  userId: UserId;
  inviteCode: string;
  now: string;
};

function toPublicGroup(group: Group): PublicGroup {
  const { inviteCodeHash: _inviteCodeHash, ...publicGroup } = group;
  return publicGroup;
}

export async function createGroup(args: CreateGroupArgs): Promise<{ group: PublicGroup; inviteCode: string }> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new Error("Group name is required");
  }

  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const inviteCode = args.inviteCode ?? generateToken(18);
  const group = await args.repo.createGroup({
    name: trimmedName,
    creatorId: args.userId,
    inviteCodeHash: await hashToken(inviteCode),
    timezone: args.timezone ?? "UTC",
    now: args.now
  });

  await args.repo.addGroupMember({
    groupId: group.id,
    userId: args.userId,
    role: "owner",
    joinedAt: args.now
  });

  return { group: toPublicGroup(group), inviteCode };
}

export async function joinGroup(args: JoinGroupArgs): Promise<{ group: PublicGroup }> {
  const inviteCode = args.inviteCode.trim();
  if (!inviteCode) {
    throw new Error("Invite code is required");
  }

  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const group = await args.repo.getGroupByInviteHash(await hashToken(inviteCode));
  if (!group) {
    throw new Error("Invite code is invalid");
  }

  await args.repo.addGroupMember({
    groupId: group.id,
    userId: args.userId,
    role: "member",
    joinedAt: args.now
  });

  return { group: toPublicGroup(group) };
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm.cmd run test:web -- src/test/groupService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit group service**

Run:

```powershell
git add apps/web/src/lib/crypto.ts apps/web/src/lib/groupService.ts apps/web/src/test/groupService.test.ts
git commit -m "feat: add group service"
```

---

### Task 5: Collector Sync Service With Tests

**Files:**

- Create: `apps/web/src/lib/collectorService.ts`
- Create: `apps/web/src/test/collectorService.test.ts`

- [ ] **Step 1: Write failing collector service tests**

Write `apps/web/src/test/collectorService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollectorDevice, syncUsage } from "@/lib/collectorService";
import { hashToken } from "@/lib/crypto";
import { MemoryRepository } from "@/lib/memoryRepository";
import { ada, now } from "./testData";

describe("collectorService", () => {
  it("creates a device token and stores only a hash", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);

    const result = await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "windows",
      deviceLabel: "Laptop",
      now,
      token: "plain-device-token"
    });

    expect(result.token).toBe("plain-device-token");
    expect(result.device.tokenHash).toBe(await hashToken("plain-device-token"));
    expect(result.device.tokenHash).not.toBe("plain-device-token");
  });

  it("rejects missing, invalid, and revoked collector tokens", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    const created = await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "darwin",
      deviceLabel: null,
      now,
      token: "valid-token"
    });
    repo.devices.set(created.device.id, { ...created.device, revokedAt: now });

    await expect(syncUsage({ repo, bearerToken: "", rows: [], now })).rejects.toThrow("Collector token is required");
    await expect(syncUsage({ repo, bearerToken: "wrong-token", rows: [], now })).rejects.toThrow("Collector token is invalid");
    await expect(syncUsage({ repo, bearerToken: "valid-token", rows: [], now })).rejects.toThrow("Collector token is revoked");
  });

  it("upserts daily usage idempotently and marks device seen", async () => {
    const repo = new MemoryRepository();
    await repo.upsertProfile(ada);
    await createCollectorDevice({
      repo,
      userId: ada.id,
      platform: "windows",
      deviceLabel: null,
      now,
      token: "valid-token"
    });

    const rows = [
      {
        usageDate: "2026-05-08",
        totalTokens: 100,
        inputTokens: 30,
        cachedInputTokens: 10,
        outputTokens: 40,
        reasoningOutputTokens: 20,
        responseCount: 2
      }
    ];

    await syncUsage({ repo, bearerToken: "valid-token", rows, now });
    await syncUsage({
      repo,
      bearerToken: "valid-token",
      rows: [{ ...rows[0], totalTokens: 150 }],
      now: "2026-05-08T13:00:00.000Z"
    });

    expect(Array.from(repo.usage.values())).toHaveLength(1);
    expect(Array.from(repo.usage.values())[0].totalTokens).toBe(150);
    expect(Array.from(repo.devices.values())[0].lastSeenAt).toBe("2026-05-08T13:00:00.000Z");
    expect(repo.syncEvents.filter((event) => event.success)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd run test:web -- src/test/collectorService.test.ts
```

Expected: FAIL because `collectorService` does not exist.

- [ ] **Step 3: Implement collector service**

Write `apps/web/src/lib/collectorService.ts`:

```ts
import { generateToken, hashToken } from "./crypto";
import type { AppRepository } from "./repository";
import type { CollectorDevice, UsageAggregateInput, UserId } from "./types";

type CreateCollectorDeviceArgs = {
  repo: AppRepository;
  userId: UserId;
  platform: string;
  deviceLabel: string | null;
  now: string;
  token?: string;
};

type SyncUsageArgs = {
  repo: AppRepository;
  bearerToken: string;
  rows: UsageAggregateInput[];
  now: string;
};

export async function createCollectorDevice(
  args: CreateCollectorDeviceArgs
): Promise<{ device: CollectorDevice; token: string }> {
  const profile = await args.repo.getProfile(args.userId);
  if (!profile) {
    throw new Error("Profile is required");
  }

  const platform = args.platform.trim();
  if (!platform) {
    throw new Error("Platform is required");
  }

  const token = args.token ?? generateToken();
  const device = await args.repo.createCollectorDevice({
    userId: args.userId,
    tokenHash: await hashToken(token),
    platform,
    deviceLabel: args.deviceLabel,
    now: args.now
  });

  return { device, token };
}

export async function syncUsage(args: SyncUsageArgs) {
  const bearerToken = args.bearerToken.trim();
  if (!bearerToken) {
    throw new Error("Collector token is required");
  }

  const device = await args.repo.getCollectorDeviceByTokenHash(await hashToken(bearerToken));
  if (!device) {
    await args.repo.createSyncEvent({
      deviceId: null,
      userId: null,
      success: false,
      message: "Collector token is invalid",
      daysSynced: 0,
      createdAt: args.now
    });
    throw new Error("Collector token is invalid");
  }

  if (device.revokedAt) {
    await args.repo.createSyncEvent({
      deviceId: device.id,
      userId: device.userId,
      success: false,
      message: "Collector token is revoked",
      daysSynced: 0,
      createdAt: args.now
    });
    throw new Error("Collector token is revoked");
  }

  const rows = args.rows.map((row) => ({
    ...row,
    source: row.source ?? "codex-jsonl"
  }));

  const upserted = await args.repo.upsertUsageDaily(device.userId, rows, args.now);
  await args.repo.updateCollectorDeviceSeen(device.id, args.now);
  await args.repo.createSyncEvent({
    deviceId: device.id,
    userId: device.userId,
    success: true,
    message: "Sync complete",
    daysSynced: rows.length,
    createdAt: args.now
  });

  return { rows: upserted };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm.cmd run test:web -- src/test/collectorService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit collector service**

Run:

```powershell
git add apps/web/src/lib/collectorService.ts apps/web/src/test/collectorService.test.ts
git commit -m "feat: add collector sync service"
```

---

### Task 6: Leaderboard Service With Tests

**Files:**

- Create: `apps/web/src/lib/ranges.ts`
- Create: `apps/web/src/lib/leaderboardService.ts`
- Create: `apps/web/src/test/leaderboardService.test.ts`

- [ ] **Step 1: Write failing leaderboard tests**

Write `apps/web/src/test/leaderboardService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLeaderboard } from "@/lib/leaderboardService";
import { createGroup } from "@/lib/groupService";
import { MemoryRepository } from "@/lib/memoryRepository";
import { ada, grace, linus, now } from "./testData";

async function setupRepo() {
  const repo = new MemoryRepository();
  await repo.upsertProfile(ada);
  await repo.upsertProfile(grace);
  await repo.upsertProfile(linus);
  const { group } = await createGroup({
    repo,
    userId: ada.id,
    name: "Friday Builders",
    timezone: "UTC",
    now,
    inviteCode: "invite-secret"
  });
  await repo.addGroupMember({ groupId: group.id, userId: grace.id, role: "member", joinedAt: now });
  await repo.upsertUsageDaily(
    ada.id,
    [
      { usageDate: "2026-05-08", totalTokens: 500, inputTokens: 200, cachedInputTokens: 50, outputTokens: 200, reasoningOutputTokens: 50, responseCount: 3 },
      { usageDate: "2026-05-01", totalTokens: 100, inputTokens: 40, cachedInputTokens: 10, outputTokens: 40, reasoningOutputTokens: 10, responseCount: 1 },
      { usageDate: "2026-04-01", totalTokens: 1000, inputTokens: 400, cachedInputTokens: 100, outputTokens: 400, reasoningOutputTokens: 100, responseCount: 6 }
    ],
    now
  );
  await repo.upsertUsageDaily(
    grace.id,
    [
      { usageDate: "2026-05-08", totalTokens: 700, inputTokens: 250, cachedInputTokens: 100, outputTokens: 250, reasoningOutputTokens: 100, responseCount: 4 }
    ],
    now
  );
  return { repo, group };
}

describe("leaderboardService", () => {
  it("rejects viewers who are not group members", async () => {
    const { repo, group } = await setupRepo();

    await expect(getLeaderboard({ repo, viewerId: linus.id, groupId: group.id, range: "today", now })).rejects.toThrow("Group not found");
  });

  it("ranks members by today totals and masks exact totals when requested", async () => {
    const { repo, group } = await setupRepo();

    const result = await getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "today", now });

    expect(result.rows.map((row) => row.displayName)).toEqual(["Grace", "Ada"]);
    expect(result.rows[0]).toMatchObject({ rank: 1, isExactTotalHidden: true, totalTokens: null });
    expect(result.rows[1]).toMatchObject({ rank: 2, isExactTotalHidden: false, totalTokens: 500 });
  });

  it("calculates week, month, year, and all ranges", async () => {
    const { repo, group } = await setupRepo();

    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "week", now })).resolves.toMatchObject({
      rows: [{ displayName: "Grace" }, { displayName: "Ada" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "month", now })).resolves.toMatchObject({
      rows: [{ displayName: "Grace" }, { displayName: "Ada" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "year", now })).resolves.toMatchObject({
      rows: [{ displayName: "Ada" }, { displayName: "Grace" }]
    });
    await expect(getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "all", now })).resolves.toMatchObject({
      rows: [{ displayName: "Ada" }, { displayName: "Grace" }]
    });
  });

  it("marks members stale when latest device seen is older than 24 hours", async () => {
    const { repo, group } = await setupRepo();
    await repo.createCollectorDevice({
      userId: ada.id,
      tokenHash: "hash",
      platform: "windows",
      deviceLabel: null,
      now: "2026-05-06T00:00:00.000Z"
    });
    const device = Array.from(repo.devices.values())[0];
    repo.devices.set(device.id, { ...device, lastSeenAt: "2026-05-06T00:00:00.000Z" });

    const result = await getLeaderboard({ repo, viewerId: ada.id, groupId: group.id, range: "today", now });

    expect(result.rows.find((row) => row.userId === ada.id)?.isStale).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd run test:web -- src/test/leaderboardService.test.ts
```

Expected: FAIL because `leaderboardService` and `ranges` do not exist.

- [ ] **Step 3: Implement date ranges**

Write `apps/web/src/lib/ranges.ts`:

```ts
import type { LeaderboardRange } from "./types";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

export function getRangeBounds(range: LeaderboardRange, nowIso: string): { startDate: string | null; endDate: string | null } {
  const now = new Date(nowIso);
  const today = toDateKey(now);

  if (range === "all") {
    return { startDate: null, endDate: null };
  }

  if (range === "today") {
    return { startDate: today, endDate: today };
  }

  if (range === "week") {
    return { startDate: toDateKey(startOfUtcWeek(now)), endDate: today };
  }

  if (range === "month") {
    return { startDate: `${today.slice(0, 8)}01`, endDate: today };
  }

  return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
}
```

- [ ] **Step 4: Implement leaderboard service**

Write `apps/web/src/lib/leaderboardService.ts`:

```ts
import { getRangeBounds } from "./ranges";
import type { AppRepository } from "./repository";
import type { GroupId, LeaderboardRange, UserId } from "./types";

export type LeaderboardRow = {
  rank: number;
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
  totalTokens: number | null;
  rawTotalTokens: number;
  isExactTotalHidden: boolean;
  lastSyncedAt: string | null;
  isStale: boolean;
};

type GetLeaderboardArgs = {
  repo: AppRepository;
  viewerId: UserId;
  groupId: GroupId;
  range: LeaderboardRange;
  now: string;
};

export async function getLeaderboard(args: GetLeaderboardArgs): Promise<{ rows: LeaderboardRow[] }> {
  const canView = await args.repo.isGroupMember(args.groupId, args.viewerId);
  if (!canView) {
    throw new Error("Group not found");
  }

  const members = await args.repo.listGroupMembers(args.groupId);
  const userIds = members.map((member) => member.userId);
  const bounds = getRangeBounds(args.range, args.now);
  const usage = await args.repo.listUsageForUsers(userIds, bounds.startDate, bounds.endDate);
  const latestSeenByUser = await args.repo.getLatestDeviceSeenByUser(userIds);
  const staleCutoff = new Date(new Date(args.now).getTime() - 24 * 60 * 60 * 1000).toISOString();

  const totals = new Map<UserId, number>();
  for (const row of usage) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.totalTokens);
  }

  return {
    rows: members
      .map((member) => {
        const rawTotalTokens = totals.get(member.userId) ?? 0;
        const lastSyncedAt = latestSeenByUser.get(member.userId) ?? null;
        return {
          rank: 0,
          userId: member.userId,
          displayName: member.profile.displayName,
          avatarUrl: member.profile.avatarUrl,
          totalTokens: member.profile.hideExactTotals ? null : rawTotalTokens,
          rawTotalTokens,
          isExactTotalHidden: member.profile.hideExactTotals,
          lastSyncedAt,
          isStale: !lastSyncedAt || lastSyncedAt < staleCutoff
        };
      })
      .sort((a, b) => b.rawTotalTokens - a.rawTotalTokens || a.displayName.localeCompare(b.displayName))
      .map((row, index) => ({ ...row, rank: index + 1 }))
  };
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm.cmd run test:web -- src/test/leaderboardService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit leaderboard service**

Run:

```powershell
git add apps/web/src/lib/ranges.ts apps/web/src/lib/leaderboardService.ts apps/web/src/test/leaderboardService.test.ts
git commit -m "feat: add leaderboard service"
```

---

### Task 7: Supabase Repository And API Routes

**Files:**

- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/supabaseRepository.ts`
- Create: `apps/web/src/app/api/groups/route.ts`
- Create: `apps/web/src/app/api/groups/join/route.ts`
- Create: `apps/web/src/app/api/groups/[id]/leaderboard/route.ts`
- Create: `apps/web/src/app/api/collector/devices/route.ts`
- Create: `apps/web/src/app/api/collector/sync/route.ts`

- [ ] **Step 1: Write auth helpers**

Write `apps/web/src/lib/auth.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service environment is not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authentication is required");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase auth environment is not configured");
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication is required");
  }
  return data.user.id;
}
```

- [ ] **Step 2: Implement Supabase repository**

Write `apps/web/src/lib/supabaseRepository.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRepository, CreateDeviceInput, CreateGroupInput } from "./repository";
import type {
  CollectorDevice,
  Group,
  GroupMember,
  Profile,
  SyncEvent,
  UsageAggregateInput,
  UsageDaily,
  UserId
} from "./types";

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? "Codex User",
    avatarUrl: row.avatar_url,
    hideExactTotals: row.hide_exact_totals
  };
}

function mapGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    creatorId: row.creator_id,
    inviteCodeHash: row.invite_code_hash,
    timezone: row.timezone,
    createdAt: row.created_at
  };
}

function mapMember(row: any): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at
  };
}

function mapDevice(row: any): CollectorDevice {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    platform: row.platform,
    deviceLabel: row.device_label,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

function mapUsage(row: any): UsageDaily {
  return {
    userId: row.user_id,
    usageDate: row.usage_date,
    source: row.source,
    totalTokens: Number(row.total_tokens),
    inputTokens: Number(row.input_tokens),
    cachedInputTokens: Number(row.cached_input_tokens),
    outputTokens: Number(row.output_tokens),
    reasoningOutputTokens: Number(row.reasoning_output_tokens),
    responseCount: Number(row.response_count),
    updatedAt: row.updated_at
  };
}

function mapSyncEvent(row: any): SyncEvent {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    success: row.success,
    message: row.message,
    daysSynced: row.days_synced,
    createdAt: row.created_at
  };
}

export class SupabaseRepository implements AppRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    assertNoError(error);
    return data ? mapProfile(data) : null;
  }

  async upsertProfile(profile: Profile) {
    const { data, error } = await this.supabase
      .from("profiles")
      .upsert({
        id: profile.id,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        hide_exact_totals: profile.hideExactTotals
      })
      .select("*")
      .single();
    assertNoError(error);
    return mapProfile(data);
  }

  async createGroup(input: CreateGroupInput) {
    const { data, error } = await this.supabase
      .from("groups")
      .insert({
        name: input.name,
        creator_id: input.creatorId,
        invite_code_hash: input.inviteCodeHash,
        timezone: input.timezone,
        created_at: input.now
      })
      .select("*")
      .single();
    assertNoError(error);
    return mapGroup(data);
  }

  async getGroup(groupId: string) {
    const { data, error } = await this.supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
    assertNoError(error);
    return data ? mapGroup(data) : null;
  }

  async getGroupByInviteHash(inviteCodeHash: string) {
    const { data, error } = await this.supabase
      .from("groups")
      .select("*")
      .eq("invite_code_hash", inviteCodeHash)
      .maybeSingle();
    assertNoError(error);
    return data ? mapGroup(data) : null;
  }

  async addGroupMember(member: GroupMember) {
    const { data: existing, error: existingError } = await this.supabase
      .from("group_members")
      .select("*")
      .eq("group_id", member.groupId)
      .eq("user_id", member.userId)
      .maybeSingle();
    assertNoError(existingError);
    if (existing) {
      return mapMember(existing);
    }

    const { data, error } = await this.supabase
      .from("group_members")
      .insert({
        group_id: member.groupId,
        user_id: member.userId,
        role: member.role,
        joined_at: member.joinedAt
      })
      .select("*")
      .single();
    assertNoError(error);
    return mapMember(data);
  }

  async isGroupMember(groupId: string, userId: string) {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    assertNoError(error);
    return Boolean(data);
  }

  async listGroupMembers(groupId: string) {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("group_id,user_id,role,joined_at,profiles(id,display_name,avatar_url,hide_exact_totals)")
      .eq("group_id", groupId);
    assertNoError(error);
    return (data ?? []).map((row: any) => {
      const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { ...mapMember(row), profile: mapProfile(profileRow) };
    });
  }

  async createCollectorDevice(input: CreateDeviceInput) {
    const { data, error } = await this.supabase
      .from("collector_devices")
      .insert({
        user_id: input.userId,
        token_hash: input.tokenHash,
        platform: input.platform,
        device_label: input.deviceLabel,
        created_at: input.now
      })
      .select("*")
      .single();
    assertNoError(error);
    return mapDevice(data);
  }

  async getCollectorDeviceByTokenHash(tokenHash: string) {
    const { data, error } = await this.supabase
      .from("collector_devices")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    assertNoError(error);
    return data ? mapDevice(data) : null;
  }

  async updateCollectorDeviceSeen(deviceId: string, seenAt: string) {
    const { error } = await this.supabase
      .from("collector_devices")
      .update({ last_seen_at: seenAt })
      .eq("id", deviceId);
    assertNoError(error);
  }

  async upsertUsageDaily(userId: string, rows: UsageAggregateInput[], now: string) {
    if (rows.length === 0) {
      return [];
    }

    const payload = rows.map((row) => ({
      user_id: userId,
      usage_date: row.usageDate,
      source: row.source ?? "codex-jsonl",
      total_tokens: row.totalTokens,
      input_tokens: row.inputTokens,
      cached_input_tokens: row.cachedInputTokens,
      output_tokens: row.outputTokens,
      reasoning_output_tokens: row.reasoningOutputTokens,
      response_count: row.responseCount,
      updated_at: now
    }));

    const { data, error } = await this.supabase
      .from("usage_daily")
      .upsert(payload, { onConflict: "user_id,usage_date,source" })
      .select("*");
    assertNoError(error);
    return (data ?? []).map(mapUsage);
  }

  async listUsageForUsers(userIds: UserId[], startDate: string | null, endDate: string | null) {
    if (userIds.length === 0) {
      return [];
    }

    let query = this.supabase.from("usage_daily").select("*").in("user_id", userIds);
    if (startDate) {
      query = query.gte("usage_date", startDate);
    }
    if (endDate) {
      query = query.lte("usage_date", endDate);
    }

    const { data, error } = await query;
    assertNoError(error);
    return (data ?? []).map(mapUsage);
  }

  async getLatestDeviceSeenByUser(userIds: UserId[]) {
    const result = new Map<UserId, string | null>();
    for (const userId of userIds) {
      result.set(userId, null);
    }
    if (userIds.length === 0) {
      return result;
    }

    const { data, error } = await this.supabase
      .from("collector_devices")
      .select("user_id,last_seen_at")
      .in("user_id", userIds)
      .is("revoked_at", null)
      .not("last_seen_at", "is", null)
      .order("last_seen_at", { ascending: false });
    assertNoError(error);

    for (const row of data ?? []) {
      if (!result.get(row.user_id)) {
        result.set(row.user_id, row.last_seen_at);
      }
    }
    return result;
  }

  async createSyncEvent(event: Omit<SyncEvent, "id" | "createdAt"> & { createdAt: string }) {
    const { data, error } = await this.supabase
      .from("sync_events")
      .insert({
        device_id: event.deviceId,
        user_id: event.userId,
        success: event.success,
        message: event.message,
        days_synced: event.daysSynced,
        created_at: event.createdAt
      })
      .select("*")
      .single();
    assertNoError(error);
    return mapSyncEvent(data);
  }
}
```

- [ ] **Step 3: Implement API route handlers**

Write each route as a thin adapter. Use `new SupabaseRepository(createSupabaseServiceClient())`, get the dashboard user with `getUserIdFromRequest` for dashboard routes, and call the service functions.

For `apps/web/src/app/api/groups/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createGroup } from "@/lib/groupService";
import { getUserIdFromRequest, createSupabaseServiceClient } from "@/lib/auth";
import { SupabaseRepository } from "@/lib/supabaseRepository";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await request.json();
    const repo = new SupabaseRepository(createSupabaseServiceClient());
    const result = await createGroup({
      repo,
      userId,
      name: body.name,
      timezone: body.timezone,
      now: new Date().toISOString()
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
```

For `apps/web/src/app/api/groups/join/route.ts`, call `joinGroup` with `body.inviteCode`.

For `apps/web/src/app/api/groups/[id]/leaderboard/route.ts`, read `params.id` and `new URL(request.url).searchParams.get("range")`, default range to `today`, reject values outside `today`, `week`, `month`, `year`, and `all`, then call `getLeaderboard`.

For `apps/web/src/app/api/collector/devices/route.ts`, call `createCollectorDevice` with `body.platform` and `body.deviceLabel ?? null`.

For `apps/web/src/app/api/collector/sync/route.ts`, do not use dashboard auth. Extract `Authorization: Bearer <device_token>`, parse `{ rows: UsageAggregateInput[] }`, and call `syncUsage`.

- [ ] **Step 4: Typecheck web app**

Run:

```powershell
npm.cmd run build --workspace apps/web
```

Expected: PASS after all `AppRepository` methods are implemented.

- [ ] **Step 5: Run web tests**

Run:

```powershell
npm.cmd run test:web
```

Expected: PASS.

- [ ] **Step 6: Commit API layer**

Run:

```powershell
git add apps/web/src/lib/auth.ts apps/web/src/lib/supabaseRepository.ts apps/web/src/app/api
git commit -m "feat: add supabase api routes"
```

---

### Task 8: Dashboard UI

**Files:**

- Create: `apps/web/src/components/Dashboard.tsx`
- Create: `apps/web/src/components/Leaderboard.tsx`
- Create: `apps/web/src/components/CollectorSetup.tsx`
- Create: `apps/web/src/test/Dashboard.test.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Write failing dashboard UI tests**

Write `apps/web/src/test/Dashboard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";

describe("Dashboard", () => {
  it("renders group controls, leaderboard tabs, and collector setup", () => {
    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Token Leaderboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create group" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Time" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate token" })).toBeInTheDocument();
  });

  it("switches leaderboard ranges", async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a collector login command after token generation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: "device-token" })
    })));

    render(<Dashboard />);
    await userEvent.click(screen.getByRole("button", { name: "Generate token" }));

    expect(await screen.findByText(/codex-tokens login --server/)).toHaveTextContent("device-token");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd run test:web -- src/test/Dashboard.test.tsx
```

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement UI components**

Write `apps/web/src/components/Leaderboard.tsx`:

```tsx
"use client";

import type { LeaderboardRange } from "@/lib/types";

const ranges: Array<{ value: LeaderboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All Time" }
];

export function Leaderboard({
  activeRange,
  onRangeChange
}: {
  activeRange: LeaderboardRange;
  onRangeChange: (range: LeaderboardRange) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Leaderboard</h2>
        <div className="tabs">
          {ranges.map((range) => (
            <button
              key={range.value}
              type="button"
              aria-pressed={activeRange === range.value}
              onClick={() => onRangeChange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="leaderboard-empty">Create or join a group to load member rankings.</div>
    </section>
  );
}
```

Write `apps/web/src/components/CollectorSetup.tsx`:

```tsx
"use client";

import { useState } from "react";

export function CollectorSetup() {
  const [token, setToken] = useState<string | null>(null);

  async function generateToken() {
    const response = await fetch("/api/collector/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: navigator.platform || "unknown", deviceLabel: "Local device" })
    });
    if (!response.ok) {
      throw new Error("Could not create device token");
    }
    const data = await response.json();
    setToken(data.token);
  }

  const server = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Collector</h2>
        <button className="primary" type="button" onClick={generateToken}>
          Generate token
        </button>
      </div>
      {token ? (
        <code className="command">codex-tokens login --server {server} --token {token}</code>
      ) : (
        <p className="muted">Generate a one-time device token, then run the login command locally.</p>
      )}
    </section>
  );
}
```

Write `apps/web/src/components/Dashboard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CollectorSetup } from "./CollectorSetup";
import { Leaderboard } from "./Leaderboard";
import type { LeaderboardRange } from "@/lib/types";

export function Dashboard() {
  const [range, setRange] = useState<LeaderboardRange>("today");

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h1>Token Leaderboard</h1>
          <p>Daily aggregate Codex usage for small friend groups.</p>
        </div>
        <button type="button">Sign in with GitHub</button>
      </header>

      <section className="grid">
        <section className="panel">
          <h2>Groups</h2>
          <div className="form-row">
            <input aria-label="Group name" placeholder="Group name" />
            <button className="primary" type="button">Create group</button>
          </div>
          <div className="form-row">
            <input aria-label="Invite code" placeholder="Invite code" />
            <button type="button">Join</button>
          </div>
        </section>

        <CollectorSetup />
      </section>

      <Leaderboard activeRange={range} onRangeChange={setRange} />
    </main>
  );
}
```

Replace `apps/web/src/app/page.tsx` with:

```tsx
import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return <Dashboard />;
}
```

Append to `apps/web/src/app/globals.css`:

```css
.dashboard {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.topbar h1,
.panel h2 {
  margin: 0;
}

.topbar p,
.muted {
  color: var(--muted);
  margin: 6px 0 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 10px;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tabs button[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.leaderboard-empty {
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  color: var(--muted);
  padding: 18px;
}

.command {
  display: block;
  overflow-wrap: anywhere;
  background: #eef2f5;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 12px;
}

@media (max-width: 760px) {
  .topbar,
  .grid {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm.cmd run test:web -- src/test/Dashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit dashboard UI**

Run:

```powershell
git add apps/web/src/components apps/web/src/test/Dashboard.test.tsx apps/web/src/app/globals.css
git commit -m "feat: add dashboard shell"
```

---

### Task 9: Collector JSONL Extraction And Aggregation

**Files:**

- Create: `collector/internal/codex/testdata/session.jsonl`
- Create: `collector/internal/codex/events.go`
- Create: `collector/internal/codex/events_test.go`
- Create: `collector/internal/codex/discover.go`
- Create: `collector/internal/aggregate/aggregate.go`
- Create: `collector/internal/aggregate/aggregate_test.go`

- [ ] **Step 1: Write privacy-focused JSONL fixture**

Write `collector/internal/codex/testdata/session.jsonl`:

```jsonl
{"timestamp":"2026-05-08T10:00:00Z","payload":{"info":{"last_token_usage":{"total_tokens":100,"input_tokens":30,"cached_input_tokens":10,"output_tokens":40,"reasoning_output_tokens":20}}},"prompt":"do not upload this","cwd":"C:\\Users\\rbhat\\secret","session_id":"raw-session"}
{"timestamp":"2026-05-08T11:00:00Z","payload":{"info":{"last_token_usage":{"total_tokens":150,"input_tokens":50,"cached_input_tokens":20,"output_tokens":60,"reasoning_output_tokens":20}}},"title":"private title","repo_path":"/private/repo"}
{"timestamp":"2026-05-09T09:00:00Z","payload":{"info":{"last_token_usage":{"total_tokens":70,"input_tokens":20,"cached_input_tokens":5,"output_tokens":35,"reasoning_output_tokens":10}}}}
```

- [ ] **Step 2: Write failing Codex parser tests**

Write `collector/internal/codex/events_test.go`:

```go
package codex

import (
	"encoding/json"
	"os"
	"testing"
)

func TestParseJSONLReadsOnlyUsageAndTimestamp(t *testing.T) {
	file, err := os.Open("testdata/session.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	events, err := ParseUsageEvents(file)
	if err != nil {
		t.Fatal(err)
	}

	if len(events) != 3 {
		t.Fatalf("expected 3 usage events, got %d", len(events))
	}
	if events[0].Usage.TotalTokens != 100 {
		t.Fatalf("expected first total 100, got %d", events[0].Usage.TotalTokens)
	}

	encoded, err := json.Marshal(events)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"do not upload this", "secret", "raw-session", "private title", "private/repo"} {
		if string(encoded) == forbidden {
			t.Fatalf("aggregate leaked forbidden value %q", forbidden)
		}
	}
}

func TestDiscoverSessionsReturnsSetupErrorWhenMissing(t *testing.T) {
	_, err := DiscoverSessionFiles(t.TempDir() + "/missing")
	if err == nil {
		t.Fatal("expected missing directory error")
	}
}
```

- [ ] **Step 3: Write failing aggregation tests**

Write `collector/internal/aggregate/aggregate_test.go`:

```go
package aggregate

import (
	"os"
	"testing"

	"github.com/codex-token-leaderboard/collector/internal/codex"
)

func TestDailyAggregatesSumTokenFields(t *testing.T) {
	file, err := os.Open("../codex/testdata/session.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	events, err := codex.ParseUsageEvents(file)
	if err != nil {
		t.Fatal(err)
	}
	rows := Daily(events)

	if len(rows) != 2 {
		t.Fatalf("expected 2 daily rows, got %d", len(rows))
	}
	first := rows[0]
	if first.UsageDate != "2026-05-08" {
		t.Fatalf("expected first date 2026-05-08, got %s", first.UsageDate)
	}
	if first.TotalTokens != 250 || first.InputTokens != 80 || first.CachedInputTokens != 30 || first.OutputTokens != 100 || first.ReasoningOutputTokens != 40 || first.ResponseCount != 2 {
		t.Fatalf("unexpected first aggregate: %+v", first)
	}
}
```

- [ ] **Step 4: Run tests to verify RED**

Run:

```powershell
cd collector
go test ./internal/codex ./internal/aggregate
```

Expected: FAIL because parser and aggregate packages do not exist.

- [ ] **Step 5: Implement JSONL parser and discovery**

Write `collector/internal/codex/events.go`:

```go
package codex

import (
	"bufio"
	"encoding/json"
	"io"
	"time"
)

type TokenUsage struct {
	TotalTokens           int64 `json:"total_tokens"`
	InputTokens           int64 `json:"input_tokens"`
	CachedInputTokens     int64 `json:"cached_input_tokens"`
	OutputTokens          int64 `json:"output_tokens"`
	ReasoningOutputTokens int64 `json:"reasoning_output_tokens"`
}

type UsageEvent struct {
	Timestamp time.Time
	Usage     TokenUsage
}

type jsonLine struct {
	Timestamp string `json:"timestamp"`
	Payload   struct {
		Info struct {
			LastTokenUsage *TokenUsage `json:"last_token_usage"`
		} `json:"info"`
	} `json:"payload"`
}

func ParseUsageEvents(reader io.Reader) ([]UsageEvent, error) {
	scanner := bufio.NewScanner(reader)
	var events []UsageEvent
	for scanner.Scan() {
		var line jsonLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			return nil, err
		}
		if line.Payload.Info.LastTokenUsage == nil || line.Timestamp == "" {
			continue
		}
		timestamp, err := time.Parse(time.RFC3339Nano, line.Timestamp)
		if err != nil {
			return nil, err
		}
		events = append(events, UsageEvent{Timestamp: timestamp, Usage: *line.Payload.Info.LastTokenUsage})
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return events, nil
}
```

Write `collector/internal/codex/discover.go`:

```go
package codex

import (
	"errors"
	"io/fs"
	"path/filepath"
)

func DiscoverSessionFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".jsonl" {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, errors.New("Codex session directory was not found; run Codex first or pass a valid sessions path")
	}
	if len(files) == 0 {
		return nil, errors.New("no Codex session JSONL files were found")
	}
	return files, nil
}
```

- [ ] **Step 6: Implement aggregation**

Write `collector/internal/aggregate/aggregate.go`:

```go
package aggregate

import (
	"sort"

	"github.com/codex-token-leaderboard/collector/internal/codex"
)

type DailyUsage struct {
	UsageDate             string `json:"usageDate"`
	Source                string `json:"source"`
	TotalTokens           int64  `json:"totalTokens"`
	InputTokens           int64  `json:"inputTokens"`
	CachedInputTokens     int64  `json:"cachedInputTokens"`
	OutputTokens          int64  `json:"outputTokens"`
	ReasoningOutputTokens int64  `json:"reasoningOutputTokens"`
	ResponseCount         int    `json:"responseCount"`
}

func Daily(events []codex.UsageEvent) []DailyUsage {
	byDate := map[string]*DailyUsage{}
	for _, event := range events {
		date := event.Timestamp.Format("2006-01-02")
		row, ok := byDate[date]
		if !ok {
			row = &DailyUsage{UsageDate: date, Source: "codex-jsonl"}
			byDate[date] = row
		}
		row.TotalTokens += event.Usage.TotalTokens
		row.InputTokens += event.Usage.InputTokens
		row.CachedInputTokens += event.Usage.CachedInputTokens
		row.OutputTokens += event.Usage.OutputTokens
		row.ReasoningOutputTokens += event.Usage.ReasoningOutputTokens
		row.ResponseCount += 1
	}

	rows := make([]DailyUsage, 0, len(byDate))
	for _, row := range byDate {
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool {
		return rows[i].UsageDate < rows[j].UsageDate
	})
	return rows
}
```

- [ ] **Step 7: Run tests to verify GREEN**

Run:

```powershell
cd collector
go test ./internal/codex ./internal/aggregate
```

Expected: PASS.

- [ ] **Step 8: Commit collector parsing**

Run:

```powershell
git add collector/internal/codex collector/internal/aggregate
git commit -m "feat: parse codex usage jsonl"
```

---

### Task 10: Collector Config And Commands

**Files:**

- Create: `collector/internal/config/config.go`
- Create: `collector/internal/config/config_test.go`
- Create: `collector/internal/cmd/root.go`
- Create: `collector/internal/cmd/login.go`
- Create: `collector/internal/cmd/preview.go`
- Create: `collector/internal/cmd/status.go`
- Modify: `collector/main.go`

- [ ] **Step 1: Write failing config tests**

Write `collector/internal/config/config_test.go`:

```go
package config

import "testing"

func TestSaveAndLoadConfig(t *testing.T) {
	path := t.TempDir() + "/config.json"
	cfg := Config{ServerURL: "http://localhost:3000", DeviceToken: "token"}

	if err := Save(path, cfg); err != nil {
		t.Fatal(err)
	}

	loaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ServerURL != cfg.ServerURL || loaded.DeviceToken != cfg.DeviceToken {
		t.Fatalf("unexpected config: %+v", loaded)
	}
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd collector
go test ./internal/config
```

Expected: FAIL because config package does not exist.

- [ ] **Step 3: Implement config package**

Write `collector/internal/config/config.go`:

```go
package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

type Config struct {
	ServerURL   string `json:"server_url"`
	DeviceToken string `json:"device_token"`
}

func DefaultPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "codex-token-leaderboard", "config.json"), nil
}

func Load(path string) (Config, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	var cfg Config
	if err := json.Unmarshal(bytes, &cfg); err != nil {
		return Config{}, err
	}
	if cfg.ServerURL == "" || cfg.DeviceToken == "" {
		return Config{}, errors.New("collector is not logged in")
	}
	return cfg, nil
}

func Save(path string, cfg Config) error {
	if cfg.ServerURL == "" || cfg.DeviceToken == "" {
		return errors.New("server URL and device token are required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	bytes, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, bytes, 0o600)
}
```

- [ ] **Step 4: Implement root, login, preview, and status commands**

Write `collector/internal/cmd/root.go`:

```go
package cmd

import "github.com/spf13/cobra"

var rootCmd = &cobra.Command{
	Use:   "codex-tokens",
	Short: "Sync local Codex token aggregates",
}

func Execute() error {
	return rootCmd.Execute()
}
```

Write `collector/internal/cmd/login.go`:

```go
package cmd

import (
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	"github.com/spf13/cobra"
)

var loginServer string
var loginToken string

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Store dashboard server and collector token",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := config.DefaultPath()
		if err != nil {
			return err
		}
		if err := config.Save(path, config.Config{ServerURL: loginServer, DeviceToken: loginToken}); err != nil {
			return err
		}
		fmt.Fprintln(cmd.OutOrStdout(), "Collector login saved")
		return nil
	},
}

func init() {
	loginCmd.Flags().StringVar(&loginServer, "server", "", "Dashboard server URL")
	loginCmd.Flags().StringVar(&loginToken, "token", "", "Collector device token")
	rootCmd.AddCommand(loginCmd)
}
```

Write `collector/internal/cmd/preview.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
	"github.com/codex-token-leaderboard/collector/internal/codex"
	"github.com/spf13/cobra"
)

var sessionsPath string

var previewCmd = &cobra.Command{
	Use:   "preview",
	Short: "Print local daily aggregates without syncing",
	RunE: func(cmd *cobra.Command, args []string) error {
		rows, err := loadLocalAggregates(sessionsPath)
		if err != nil {
			return err
		}
		encoded, err := json.MarshalIndent(rows, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(cmd.OutOrStdout(), string(encoded))
		return nil
	},
}

func defaultSessionsPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".codex", "sessions")
}

func loadLocalAggregates(path string) ([]aggregate.DailyUsage, error) {
	if path == "" {
		path = defaultSessionsPath()
	}
	files, err := codex.DiscoverSessionFiles(path)
	if err != nil {
		return nil, err
	}
	var events []codex.UsageEvent
	for _, filePath := range files {
		file, err := os.Open(filePath)
		if err != nil {
			return nil, err
		}
		parsed, parseErr := codex.ParseUsageEvents(file)
		closeErr := file.Close()
		if parseErr != nil {
			return nil, parseErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		events = append(events, parsed...)
	}
	return aggregate.Daily(events), nil
}

func init() {
	previewCmd.Flags().StringVar(&sessionsPath, "sessions", "", "Codex sessions directory")
	rootCmd.AddCommand(previewCmd)
}
```

Write `collector/internal/cmd/status.go`:

```go
package cmd

import (
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show collector configuration status",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := config.DefaultPath()
		if err != nil {
			return err
		}
		cfg, err := config.Load(path)
		if err != nil {
			fmt.Fprintln(cmd.OutOrStdout(), "Collector is not logged in")
			return nil
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Server: %s\nToken: configured\n", cfg.ServerURL)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(statusCmd)
}
```

Replace `collector/main.go` with:

```go
package main

import (
	"os"

	"github.com/codex-token-leaderboard/collector/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
cd collector
go test ./internal/config ./internal/cmd
```

Expected: PASS.

- [ ] **Step 6: Commit collector commands**

Run:

```powershell
git add collector/internal/config collector/internal/cmd collector/main.go collector/go.mod collector/go.sum
git commit -m "feat: add collector cli commands"
```

---

### Task 11: Collector Sync Client And Sync Command

**Files:**

- Create: `collector/internal/sync/client.go`
- Create: `collector/internal/sync/client_test.go`
- Create: `collector/internal/cmd/sync.go`

- [ ] **Step 1: Write failing sync client tests**

Write `collector/internal/sync/client_test.go`:

```go
package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
)

func TestClientPostsAggregatesWithBearerToken(t *testing.T) {
	var auth string
	var body struct {
		Rows []aggregate.DailyUsage `json:"rows"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"rows":[]}`))
	}))
	defer server.Close()

	client := Client{ServerURL: server.URL, DeviceToken: "device-token", HTTPClient: server.Client()}
	err := client.Upload([]aggregate.DailyUsage{{UsageDate: "2026-05-08", TotalTokens: 100}})
	if err != nil {
		t.Fatal(err)
	}

	if auth != "Bearer device-token" {
		t.Fatalf("unexpected auth header %q", auth)
	}
	if len(body.Rows) != 1 || body.Rows[0].TotalTokens != 100 {
		t.Fatalf("unexpected body: %+v", body)
	}
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd collector
go test ./internal/sync
```

Expected: FAIL because sync package does not exist.

- [ ] **Step 3: Implement sync client**

Write `collector/internal/sync/client.go`:

```go
package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
)

type Client struct {
	ServerURL   string
	DeviceToken string
	HTTPClient  *http.Client
}

func (c Client) Upload(rows []aggregate.DailyUsage) error {
	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	payload := struct {
		Rows []aggregate.DailyUsage `json:"rows"`
	}{Rows: rows}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := strings.TrimRight(c.ServerURL, "/") + "/api/collector/sync"
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.DeviceToken)
	request.Header.Set("Content-Type", "application/json")

	response, err := httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("sync failed with status %d", response.StatusCode)
	}
	return nil
}
```

- [ ] **Step 4: Implement sync command**

Write `collector/internal/cmd/sync.go`:

```go
package cmd

import (
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	collectorsync "github.com/codex-token-leaderboard/collector/internal/sync"
	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Upload local daily aggregates",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := config.DefaultPath()
		if err != nil {
			return err
		}
		cfg, err := config.Load(path)
		if err != nil {
			return err
		}
		rows, err := loadLocalAggregates(sessionsPath)
		if err != nil {
			return err
		}
		client := collectorsync.Client{ServerURL: cfg.ServerURL, DeviceToken: cfg.DeviceToken}
		if err := client.Upload(rows); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Synced %d daily aggregate rows\n", len(rows))
		return nil
	},
}

func init() {
	syncCmd.Flags().StringVar(&sessionsPath, "sessions", "", "Codex sessions directory")
	rootCmd.AddCommand(syncCmd)
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
cd collector
go test ./internal/sync ./internal/cmd
```

Expected: PASS.

- [ ] **Step 6: Commit sync client**

Run:

```powershell
git add collector/internal/sync collector/internal/cmd/sync.go
git commit -m "feat: add collector sync upload"
```

---

### Task 12: End-To-End Verification And Polish

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm.cmd run test:web
npm.cmd run build --workspace apps/web
cd collector
go test ./...
```

Expected: all commands PASS.

- [ ] **Step 2: Run collector preview against fixture**

Run:

```powershell
cd collector
go run . preview --sessions .\internal\codex\testdata
```

Expected output includes exactly aggregate rows for `2026-05-08` and `2026-05-09`, and does not include prompt text, local paths, title text, repository paths, or session IDs from the fixture.

- [ ] **Step 3: Start the web app locally**

Run:

```powershell
npm.cmd run dev --workspace apps/web
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 4: Verify dashboard visually in Browser**

Open the local URL in the Codex Browser plugin. Check desktop and mobile widths. Confirm:

- The first screen is the functional dashboard, not a landing page.
- Group controls, collector setup, and leaderboard tabs are visible.
- Text fits inside buttons and panels.
- The layout is not dominated by one hue family.
- No overlapping UI appears at mobile width.

- [ ] **Step 5: Update README with run instructions**

Add these sections to `README.md`:

```markdown
## Run Web

```powershell
npm.cmd install
npm.cmd run dev --workspace apps/web
```

## Run Collector Preview

```powershell
cd collector
go run . preview
```

To preview against the included fixture:

```powershell
cd collector
go run . preview --sessions .\internal\codex\testdata
```

## Sync Flow

1. Sign in to the dashboard.
2. Generate a collector token.
3. Run `codex-tokens login --server <url> --token <device_token>`.
4. Run `codex-tokens preview`.
5. Run `codex-tokens sync`.
```

- [ ] **Step 6: Commit verification polish**

Run:

```powershell
git add README.md apps/web collector packages/db
git commit -m "docs: add local verification notes"
```

---

## Self-Review Checklist

- [x] Spec coverage: monorepo, DB migration, API routes, collector preview/login/sync/status, JSONL extraction, aggregate upload, leaderboard ranges, masking, stale sync, and tests are covered.
- [x] Privacy boundary: collector parser and preview fixture explicitly test that prompt-like and path-like fields are ignored.
- [x] Idempotency: web collector service tests cover repeated sync replacing the same daily row.
- [x] Group authorization: leaderboard service tests reject non-members.
- [x] UI coverage: dashboard shell renders group controls, leaderboard tabs, and collector token command.
- [x] Deferred scope remains deferred: SQLite fallback and scheduled install commands are not included in the implementation tasks.

Self-review result: no spec coverage gaps, unresolved placeholders, or type naming mismatches found.
