-- ---------------------------------------------------------------------------
-- Dynamic Pass Builder schema
--
-- Replaces the legacy wallet_passes table with a normalized pass design model.
-- Run with: supabase db push
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Drop legacy table (demo data only; no production migration path needed)
drop trigger if exists wallet_passes_set_updated_at on public.wallet_passes;
drop table if exists public.wallet_events cascade;
drop table if exists public.wallet_passes cascade;

-- ---------------------------------------------------------------------------
-- passes — main pass design record
-- ---------------------------------------------------------------------------
create table if not exists public.passes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid null,
  name                 text not null,
  pass_type            text not null default 'generic'
                         check (pass_type in ('generic', 'loyalty', 'coupon', 'eventTicket', 'boardingPass')),
  organization_name    text not null,
  description          text not null default '',
  logo_text            text not null default '',
  background_color     text not null default '#0B1220',
  foreground_color     text not null default '#FFFFFF',
  label_color          text not null default '#9CC3FF',
  logo_url             text null,
  strip_url            text null,
  thumbnail_url        text null,
  background_url       text null,
  serial_number        text not null,
  relevant_date        timestamptz null,
  expiration_date      timestamptz null,
  valid_from           timestamptz null,
  valid_until          timestamptz null,
  relevant_date_enabled    boolean not null default false,
  expiration_date_enabled  boolean not null default false,
  valid_from_enabled       boolean not null default false,
  valid_until_enabled      boolean not null default false,
  status               text not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists passes_serial_number_idx on public.passes (serial_number);
create index if not exists passes_user_id_idx on public.passes (user_id);
create index if not exists passes_created_at_idx on public.passes (created_at desc);
create index if not exists passes_status_idx on public.passes (status);

-- ---------------------------------------------------------------------------
-- pass_fields — dynamic display fields
-- ---------------------------------------------------------------------------
create table if not exists public.pass_fields (
  id              uuid primary key default gen_random_uuid(),
  pass_id         uuid not null references public.passes (id) on delete cascade,
  field_group     text not null
                    check (field_group in ('header', 'primary', 'secondary', 'auxiliary', 'back')),
  field_key       text not null,
  label           text not null default '',
  value           text not null default '',
  text_alignment  text not null default 'left'
                    check (text_alignment in ('left', 'center', 'right')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pass_fields_pass_id_idx on public.pass_fields (pass_id, field_group, sort_order);

-- ---------------------------------------------------------------------------
-- pass_barcodes
-- ---------------------------------------------------------------------------
create table if not exists public.pass_barcodes (
  id              uuid primary key default gen_random_uuid(),
  pass_id         uuid not null unique references public.passes (id) on delete cascade,
  barcode_type    text not null default 'QR'
                    check (barcode_type in ('QR', 'PDF417', 'Aztec', 'Code128')),
  barcode_value   text not null default '',
  alt_text        text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pass_locations
-- ---------------------------------------------------------------------------
create table if not exists public.pass_locations (
  id              uuid primary key default gen_random_uuid(),
  pass_id         uuid not null references public.passes (id) on delete cascade,
  latitude        double precision not null,
  longitude       double precision not null,
  relevant_text   text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pass_locations_pass_id_idx on public.pass_locations (pass_id);

-- ---------------------------------------------------------------------------
-- wallet_passes — generated wallet artifacts
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_passes (
  id                          uuid primary key default gen_random_uuid(),
  pass_id                     uuid not null unique references public.passes (id) on delete cascade,
  apple_pass_url              text null,
  apple_serial_number         text null unique,
  apple_pass_type_identifier  text null,
  apple_generated_at          timestamptz null,
  google_class_id             text null,
  google_object_id            text null unique,
  google_save_url             text null,
  google_generated_at         timestamptz null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists wallet_passes_pass_id_idx on public.wallet_passes (pass_id);

-- ---------------------------------------------------------------------------
-- wallet_events (analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_events (
  id              uuid primary key default gen_random_uuid(),
  pass_id         uuid not null references public.passes (id) on delete cascade,
  platform        text not null check (platform in ('apple', 'google', 'system')),
  event_type      text not null,
  metadata        jsonb null,
  created_at      timestamptz not null default now()
);

create index if not exists wallet_events_pass_idx on public.wallet_events (pass_id, created_at desc);
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

drop trigger if exists passes_set_updated_at on public.passes;
create trigger passes_set_updated_at
  before update on public.passes
  for each row execute function public.set_updated_at();

drop trigger if exists pass_fields_set_updated_at on public.pass_fields;
create trigger pass_fields_set_updated_at
  before update on public.pass_fields
  for each row execute function public.set_updated_at();

drop trigger if exists pass_barcodes_set_updated_at on public.pass_barcodes;
create trigger pass_barcodes_set_updated_at
  before update on public.pass_barcodes
  for each row execute function public.set_updated_at();

drop trigger if exists pass_locations_set_updated_at on public.pass_locations;
create trigger pass_locations_set_updated_at
  before update on public.pass_locations
  for each row execute function public.set_updated_at();

drop trigger if exists wallet_passes_set_updated_at on public.wallet_passes;
create trigger wallet_passes_set_updated_at
  before update on public.wallet_passes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.passes enable row level security;
alter table public.pass_fields enable row level security;
alter table public.pass_barcodes enable row level security;
alter table public.pass_locations enable row level security;
alter table public.wallet_passes enable row level security;
alter table public.wallet_events enable row level security;

-- passes
drop policy if exists "passes_select_own" on public.passes;
create policy "passes_select_own" on public.passes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "passes_insert_own" on public.passes;
create policy "passes_insert_own" on public.passes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "passes_update_own" on public.passes;
create policy "passes_update_own" on public.passes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "passes_delete_own" on public.passes;
create policy "passes_delete_own" on public.passes for delete to authenticated
  using (user_id = auth.uid());

-- pass_fields (via pass ownership)
drop policy if exists "pass_fields_select_own" on public.pass_fields;
create policy "pass_fields_select_own" on public.pass_fields for select to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_fields_insert_own" on public.pass_fields;
create policy "pass_fields_insert_own" on public.pass_fields for insert to authenticated
  with check (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_fields_update_own" on public.pass_fields;
create policy "pass_fields_update_own" on public.pass_fields for update to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_fields_delete_own" on public.pass_fields;
create policy "pass_fields_delete_own" on public.pass_fields for delete to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

-- pass_barcodes
drop policy if exists "pass_barcodes_select_own" on public.pass_barcodes;
create policy "pass_barcodes_select_own" on public.pass_barcodes for select to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_barcodes_insert_own" on public.pass_barcodes;
create policy "pass_barcodes_insert_own" on public.pass_barcodes for insert to authenticated
  with check (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_barcodes_update_own" on public.pass_barcodes;
create policy "pass_barcodes_update_own" on public.pass_barcodes for update to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

-- pass_locations
drop policy if exists "pass_locations_select_own" on public.pass_locations;
create policy "pass_locations_select_own" on public.pass_locations for select to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_locations_insert_own" on public.pass_locations;
create policy "pass_locations_insert_own" on public.pass_locations for insert to authenticated
  with check (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_locations_update_own" on public.pass_locations;
create policy "pass_locations_update_own" on public.pass_locations for update to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "pass_locations_delete_own" on public.pass_locations;
create policy "pass_locations_delete_own" on public.pass_locations for delete to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

-- wallet_passes
drop policy if exists "wallet_passes_select_own" on public.wallet_passes;
create policy "wallet_passes_select_own" on public.wallet_passes for select to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "wallet_passes_insert_own" on public.wallet_passes;
create policy "wallet_passes_insert_own" on public.wallet_passes for insert to authenticated
  with check (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "wallet_passes_update_own" on public.wallet_passes;
create policy "wallet_passes_update_own" on public.wallet_passes for update to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

-- wallet_events
drop policy if exists "wallet_events_select_own" on public.wallet_events;
create policy "wallet_events_select_own" on public.wallet_events for select to authenticated
  using (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

drop policy if exists "wallet_events_insert_own" on public.wallet_events;
create policy "wallet_events_insert_own" on public.wallet_events for insert to authenticated
  with check (exists (select 1 from public.passes p where p.id = pass_id and p.user_id = auth.uid()));

revoke all on public.passes from anon;
revoke all on public.pass_fields from anon;
revoke all on public.pass_barcodes from anon;
revoke all on public.pass_locations from anon;
revoke all on public.wallet_passes from anon;
revoke all on public.wallet_events from anon;

-- ---------------------------------------------------------------------------
-- Storage bucket for pass assets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pass-assets', 'pass-assets', true)
on conflict (id) do nothing;

drop policy if exists "pass_assets_select" on storage.objects;
create policy "pass_assets_select" on storage.objects for select
  using (bucket_id = 'pass-assets');

drop policy if exists "pass_assets_insert" on storage.objects;
create policy "pass_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pass_assets_update" on storage.objects;
create policy "pass_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pass_assets_delete" on storage.objects;
create policy "pass_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);
