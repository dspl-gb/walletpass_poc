-- ---------------------------------------------------------------------------
-- Wallet Pass Demo - initial schema
--
-- Run this in the Supabase SQL editor, or with the Supabase CLI:
--   supabase db push
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- wallet_passes
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_passes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid null,
  member_id            text not null unique,
  pass_type            text not null default 'Membership',
  holder_name          text not null,
  company_name         text not null,
  email                text null,
  qr_value             text not null,
  expiration_date      timestamptz null,
  status               text not null default 'active'
                         check (status in ('active', 'expired', 'revoked')),
  apple_serial_number  text null unique,
  google_object_id     text null unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists wallet_passes_user_id_idx on public.wallet_passes (user_id);
create index if not exists wallet_passes_created_at_idx on public.wallet_passes (created_at desc);

-- ---------------------------------------------------------------------------
-- wallet_events (analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_events (
  id              uuid primary key default gen_random_uuid(),
  wallet_pass_id  uuid not null references public.wallet_passes (id) on delete cascade,
  platform        text not null check (platform in ('apple', 'google', 'system')),
  event_type      text not null,
  metadata        jsonb null,
  created_at      timestamptz not null default now()
);

create index if not exists wallet_events_pass_idx on public.wallet_events (wallet_pass_id, created_at desc);
create index if not exists wallet_events_type_idx on public.wallet_events (event_type, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_passes_set_updated_at on public.wallet_passes;
create trigger wallet_passes_set_updated_at
  before update on public.wallet_passes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This build has no end-user login flow: every read/write happens through the
-- Next.js server using the service role key, which bypasses RLS, and the server
-- enforces ownership against an httpOnly owner cookie.
--
-- RLS is still enabled and locked down so that the anon/authenticated keys
-- (which are the only keys that could ever reach a browser) cannot read or
-- write anything they do not own. When you later add Supabase Auth, the
-- policies below already scope rows to auth.uid().
-- ---------------------------------------------------------------------------
alter table public.wallet_passes enable row level security;
alter table public.wallet_events enable row level security;

drop policy if exists "wallet_passes_select_own" on public.wallet_passes;
create policy "wallet_passes_select_own"
  on public.wallet_passes
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wallet_passes_insert_own" on public.wallet_passes;
create policy "wallet_passes_insert_own"
  on public.wallet_passes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wallet_passes_update_own" on public.wallet_passes;
create policy "wallet_passes_update_own"
  on public.wallet_passes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wallet_passes_delete_own" on public.wallet_passes;
create policy "wallet_passes_delete_own"
  on public.wallet_passes
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wallet_events_select_own" on public.wallet_events;
create policy "wallet_events_select_own"
  on public.wallet_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.wallet_passes p
      where p.id = wallet_events.wallet_pass_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "wallet_events_insert_own" on public.wallet_events;
create policy "wallet_events_insert_own"
  on public.wallet_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.wallet_passes p
      where p.id = wallet_events.wallet_pass_id
        and p.user_id = auth.uid()
    )
  );

-- The anon key gets nothing at all.
revoke all on public.wallet_passes from anon;
revoke all on public.wallet_events from anon;
