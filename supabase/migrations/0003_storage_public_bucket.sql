-- Ensure pass-assets bucket exists and stays public for logo URLs used by PassKit.
insert into storage.buckets (id, name, public)
values ('pass-assets', 'pass-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read access for pass artwork (required for Apple Wallet server-side fetch).
drop policy if exists "pass_assets_select" on storage.objects;
create policy "pass_assets_select" on storage.objects for select
  using (bucket_id = 'pass-assets');

-- Service-role uploads bypass RLS, but add an explicit policy for authenticated
-- users who later adopt Supabase Auth with owner id as the first folder segment.
drop policy if exists "pass_assets_insert" on storage.objects;
create policy "pass_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pass_assets_update" on storage.objects;
create policy "pass_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pass_assets_delete" on storage.objects;
create policy "pass_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pass-assets' and (storage.foldername(name))[1] = auth.uid()::text);
