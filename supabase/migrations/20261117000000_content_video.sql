-- ---------------------------------------------------------------------------
-- Video in the media library, and journal entries that point at it.
--
-- WHAT
--   storage bucket `content-video`   public, 50 MB per object, MP4/WebM only,
--                                    admin-only writes (the product-media
--                                    policy shape).
--   media_assets                     the MIME allow-list gains video/mp4 and
--                                    video/webm; a new NOT VALID check keeps
--                                    video in content-video and images in
--                                    product-media for every new row.
--   journal_entries.video_asset_id   a library video for the entry.
--   journal_entries.video_bucket /
--   journal_entries.video_object_path
--                                    copied from media_assets by a trigger.
--                                    media_assets is admin-only, so the public
--                                    journal page cannot join it; the trigger
--                                    keeps the copy honest.
--
-- WHY
--   A journal video was a file in public/ typed in as a path, so adding one
--   took a code change and a deploy (docs/content-images-to-storage.md, "Known
--   limitation: journal video"). Video is too large for the app's 4 MB upload
--   path, so the admin uploads straight to this bucket with a signed URL.
--
-- COMPATIBILITY
--   Additive only. video_path stays and keeps working (the existing kaolin
--   entry). Code deployed before this migration never reads the new columns.
--
-- ROLLBACK
--   alter table public.journal_entries
--     drop constraint if exists journal_entries_one_video,
--     drop column if exists video_object_path,
--     drop column if exists video_bucket,
--     drop column if exists video_asset_id;
--   drop trigger if exists journal_entries_sync_video on public.journal_entries;
--   drop function if exists public.sync_journal_entry_video();
--   alter table public.media_assets drop constraint if exists media_assets_bucket_kind_check;
--   (restore media_assets_mime_allowed to the four image types — only once no
--   video rows remain)
--   drop the four content_video_* policies; delete the bucket once it is empty.
-- ---------------------------------------------------------------------------

-- ---- bucket -------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-video', 'content-video', true, 52428800, array['video/mp4', 'video/webm'])
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_video_public_read  on storage.objects;
drop policy if exists content_video_admin_insert on storage.objects;
drop policy if exists content_video_admin_update on storage.objects;
drop policy if exists content_video_admin_delete on storage.objects;

create policy content_video_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'content-video');

create policy content_video_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-video' and public.has_admin_role());

create policy content_video_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'content-video' and public.has_admin_role())
  with check (bucket_id = 'content-video' and public.has_admin_role());

create policy content_video_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'content-video' and public.has_admin_role());

-- ---- media_assets -------------------------------------------------------------

alter table public.media_assets drop constraint if exists media_assets_mime_allowed;
alter table public.media_assets add constraint media_assets_mime_allowed check (
  mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm')
);

alter table public.media_assets drop constraint if exists media_assets_bucket_kind_check;
alter table public.media_assets add constraint media_assets_bucket_kind_check check (
  (mime_type like 'video/%' and bucket_id = 'content-video')
  or (mime_type like 'image/%' and bucket_id = 'product-media')
) not valid;

-- ---- journal_entries ----------------------------------------------------------

alter table public.journal_entries
  add column if not exists video_asset_id    uuid references public.media_assets (id) on delete restrict,
  add column if not exists video_bucket      text,
  add column if not exists video_object_path text;

alter table public.journal_entries drop constraint if exists journal_entries_one_video;
alter table public.journal_entries add constraint journal_entries_one_video
  check (video_path is null or video_asset_id is null);

comment on column public.journal_entries.video_asset_id is
  'A library video (media_assets, content-video bucket). Mutually exclusive with the legacy video_path.';
comment on column public.journal_entries.video_object_path is
  'Copied from media_assets by sync_journal_entry_video(); the public page derives the URL from bucket + path.';

create index if not exists idx_journal_entries_video_asset
  on public.journal_entries (video_asset_id) where video_asset_id is not null;

-- Security definer: media_assets is readable by administrators only, and the
-- copy must be right whoever writes the row. It reads exactly one row by id.
create or replace function public.sync_journal_entry_video()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset record;
begin
  if new.video_asset_id is null then
    new.video_bucket := null;
    new.video_object_path := null;
    return new;
  end if;

  select bucket_id, object_path, mime_type into v_asset
  from public.media_assets
  where id = new.video_asset_id and deleted_at is null;

  if not found or v_asset.mime_type not like 'video/%' then
    raise exception 'Seçilen dosya kütüphanede bir video değil.' using errcode = '22023';
  end if;

  new.video_bucket := v_asset.bucket_id;
  new.video_object_path := v_asset.object_path;
  return new;
end;
$$;

revoke execute on function public.sync_journal_entry_video() from public, anon, authenticated;

drop trigger if exists journal_entries_sync_video on public.journal_entries;
create trigger journal_entries_sync_video
before insert or update on public.journal_entries
for each row execute function public.sync_journal_entry_video();
