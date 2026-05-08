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
