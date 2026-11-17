-- ---------------------------------------------------------------------------
-- The /magaza slider: media slides or featured products, administered from
-- /admin/content and saved in one transaction.
--
-- WHAT
--   public.shop_slider_config      one row: mode (off | media | products) and
--                                  whether the first three featured products
--                                  sit under a media slider.
--   public.shop_slides             up to six media slides (image or video, an
--                                  optional poster for video, optional headline
--                                  and in-site link). bucket/path/mime are
--                                  copied from media_assets by a trigger,
--                                  because the storefront reads as anon and
--                                  media_assets is admin-only.
--   public.shop_featured_products  up to twelve products, ordered.
--   public.admin_save_shop_slider  replaces all three in one transaction.
--
-- WHY
--   Foreign keys, not JSON in site_settings: a slide's media cannot be deleted
--   from the library while in use (on delete restrict), and a deleted product
--   leaves the featured list on its own (on delete cascade). Inactive products
--   are filtered when read.
--
-- CARRY-OVER
--   The slider replaces the single shop banner. If that banner is switched on
--   and its image is a live library image, it becomes the first slide and the
--   slider starts in media mode. Only into an empty slider, so re-running this
--   changes nothing. The shop_banner_* settings are left in place: the code
--   deployed before this migration still reads them.
--
-- SECURITY
--   RLS on all three tables: everyone may read (the storefront), administrators
--   may write. The RPC is security invoker and re-checks has_admin_role(), so it
--   fails closed even if a policy is ever loosened.
--
-- ROLLBACK
--   drop function public.admin_save_shop_slider(text, boolean, jsonb, uuid[]);
--   drop table public.shop_featured_products;
--   drop table public.shop_slides;
--   drop table public.shop_slider_config;
--   drop function public.sync_shop_slide_media();
--   Nothing outside the slider depends on these objects.
-- ---------------------------------------------------------------------------

create table if not exists public.shop_slider_config (
  id                  boolean primary key default true check (id),
  mode                text        not null default 'off' check (mode in ('off', 'media', 'products')),
  show_featured_below boolean     not null default false,
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);

insert into public.shop_slider_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.shop_slides (
  id              uuid primary key default gen_random_uuid(),
  media_asset_id  uuid not null references public.media_assets (id) on delete restrict,
  poster_asset_id uuid references public.media_assets (id) on delete restrict,
  media_bucket    text,
  media_path      text,
  media_mime      text,
  poster_bucket   text,
  poster_path     text,
  headline        text,
  alt_text        text,
  link_href       text,
  link_label      text,
  sort_order      integer not null,
  constraint shop_slides_sort_check check (sort_order between 0 and 5),
  constraint shop_slides_sort_unique unique (sort_order),
  constraint shop_slides_headline_check check (headline is null or char_length(headline) <= 80),
  constraint shop_slides_alt_check check (alt_text is null or char_length(alt_text) <= 200),
  constraint shop_slides_link_check check (
    (link_href is null and link_label is null)
    or (link_href is not null and link_label is not null
        and char_length(link_href) <= 300 and link_href ~ '^/[^/]'
        and char_length(btrim(link_label)) between 1 and 30)
  )
);

create table if not exists public.shop_featured_products (
  product_id uuid    not null unique references public.products (id) on delete cascade,
  sort_order integer not null,
  constraint shop_featured_products_sort_check check (sort_order between 0 and 11),
  constraint shop_featured_products_sort_unique unique (sort_order)
);

comment on table public.shop_slider_config is 'The /magaza slider mode. One row.';
comment on table public.shop_slides is 'Media slides of the /magaza slider, ordered; media fields copied from media_assets.';
comment on table public.shop_featured_products is 'Featured products of the /magaza slider, ordered.';

create index if not exists idx_shop_slides_media on public.shop_slides (media_asset_id);
create index if not exists idx_shop_slides_poster on public.shop_slides (poster_asset_id) where poster_asset_id is not null;

-- ---- media copy ---------------------------------------------------------------

create or replace function public.sync_shop_slide_media()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_media  record;
  v_poster record;
begin
  select bucket_id, object_path, mime_type into v_media
  from public.media_assets
  where id = new.media_asset_id and deleted_at is null;
  if not found then
    raise exception 'Slayt medyası kütüphanede bulunamadı.' using errcode = '22023';
  end if;

  new.media_bucket := v_media.bucket_id;
  new.media_path   := v_media.object_path;
  new.media_mime   := v_media.mime_type;

  if new.poster_asset_id is null then
    new.poster_bucket := null;
    new.poster_path   := null;
  else
    if v_media.mime_type not like 'video/%' then
      raise exception 'Kapak görseli yalnızca video slaytlarında kullanılır.' using errcode = '22023';
    end if;
    select bucket_id, object_path, mime_type into v_poster
    from public.media_assets
    where id = new.poster_asset_id and deleted_at is null;
    if not found or v_poster.mime_type not like 'image/%' then
      raise exception 'Kapak görseli kütüphanede bir görsel olmalı.' using errcode = '22023';
    end if;
    new.poster_bucket := v_poster.bucket_id;
    new.poster_path   := v_poster.object_path;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_shop_slide_media() from public, anon, authenticated;

drop trigger if exists shop_slides_sync_media on public.shop_slides;
create trigger shop_slides_sync_media
before insert or update on public.shop_slides
for each row execute function public.sync_shop_slide_media();

-- ---- RLS ----------------------------------------------------------------------

alter table public.shop_slider_config     enable row level security;
alter table public.shop_slides            enable row level security;
alter table public.shop_featured_products enable row level security;

drop policy if exists shop_slider_config_public_read  on public.shop_slider_config;
drop policy if exists shop_slider_config_admin_update on public.shop_slider_config;
create policy shop_slider_config_public_read on public.shop_slider_config
  for select to anon, authenticated using (true);
create policy shop_slider_config_admin_update on public.shop_slider_config
  for update to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());

drop policy if exists shop_slides_public_read  on public.shop_slides;
drop policy if exists shop_slides_admin_insert on public.shop_slides;
drop policy if exists shop_slides_admin_update on public.shop_slides;
drop policy if exists shop_slides_admin_delete on public.shop_slides;
create policy shop_slides_public_read on public.shop_slides
  for select to anon, authenticated using (true);
create policy shop_slides_admin_insert on public.shop_slides
  for insert to authenticated with check (public.has_admin_role());
create policy shop_slides_admin_update on public.shop_slides
  for update to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());
create policy shop_slides_admin_delete on public.shop_slides
  for delete to authenticated using (public.has_admin_role());

drop policy if exists shop_featured_public_read  on public.shop_featured_products;
drop policy if exists shop_featured_admin_insert on public.shop_featured_products;
drop policy if exists shop_featured_admin_update on public.shop_featured_products;
drop policy if exists shop_featured_admin_delete on public.shop_featured_products;
create policy shop_featured_public_read on public.shop_featured_products
  for select to anon, authenticated using (true);
create policy shop_featured_admin_insert on public.shop_featured_products
  for insert to authenticated with check (public.has_admin_role());
create policy shop_featured_admin_update on public.shop_featured_products
  for update to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());
create policy shop_featured_admin_delete on public.shop_featured_products
  for delete to authenticated using (public.has_admin_role());

revoke all on public.shop_slider_config     from anon, authenticated;
revoke all on public.shop_slides            from anon, authenticated;
revoke all on public.shop_featured_products from anon, authenticated;

grant select on public.shop_slider_config     to anon;
grant select on public.shop_slides            to anon;
grant select on public.shop_featured_products to anon;

grant select, update                 on public.shop_slider_config     to authenticated;
grant select, insert, update, delete on public.shop_slides            to authenticated;
grant select, insert, update, delete on public.shop_featured_products to authenticated;

-- ---- save RPC -----------------------------------------------------------------

create or replace function public.admin_save_shop_slider(
  p_mode                text,
  p_show_featured_below boolean,
  p_slides              jsonb,
  p_featured            uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_slide_count    integer;
  v_featured_count integer;
begin
  if not public.has_admin_role() then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('off', 'media', 'products') then
    raise exception 'Gösterim türü geçersiz.' using errcode = '22023';
  end if;
  if p_slides is null or jsonb_typeof(p_slides) <> 'array' then
    raise exception 'Slayt listesi geçersiz.' using errcode = '22023';
  end if;

  v_slide_count    := jsonb_array_length(p_slides);
  v_featured_count := coalesce(cardinality(p_featured), 0);

  if v_slide_count > 6 then
    raise exception 'En fazla 6 slayt eklenebilir.' using errcode = '22023';
  end if;
  if v_featured_count > 12 then
    raise exception 'En fazla 12 öne çıkan ürün seçilebilir.' using errcode = '22023';
  end if;
  if v_featured_count > 0
     and (select count(distinct x) from unnest(p_featured) as x) <> v_featured_count then
    raise exception 'Aynı ürün birden fazla kez seçilemez.' using errcode = '22023';
  end if;
  if v_featured_count > 0 and exists (
    select 1 from unnest(p_featured) as x
    where not exists (select 1 from public.products p where p.id = x and p.is_active)
  ) then
    raise exception 'Öne çıkan ürünler yayında olmalı.' using errcode = '22023';
  end if;
  if p_mode = 'media' and v_slide_count = 0 then
    raise exception 'Medya slider''ı için en az bir slayt ekleyin.' using errcode = '22023';
  end if;
  if p_mode = 'products' and v_featured_count = 0 then
    raise exception 'Öne çıkan ürünler için en az bir ürün seçin.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_slides) as t(item)
    where jsonb_typeof(t.item) <> 'object'
       or coalesce(t.item ->> 'media_asset_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or (nullif(t.item ->> 'poster_asset_id', '') is not null
           and t.item ->> 'poster_asset_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise exception 'Slayt bilgisi geçersiz.' using errcode = '22023';
  end if;

  -- Serialise concurrent saves on the one config row.
  perform 1 from public.shop_slider_config where id for update;

  -- The whole slider is replaced: both lists are rewritten from the payload.
  delete from public.shop_slides where id is not null;
  delete from public.shop_featured_products where product_id is not null;

  insert into public.shop_slides (
    media_asset_id, poster_asset_id, headline, alt_text, link_href, link_label, sort_order
  )
  select (t.item ->> 'media_asset_id')::uuid,
         nullif(t.item ->> 'poster_asset_id', '')::uuid,
         nullif(btrim(t.item ->> 'headline'), ''),
         nullif(btrim(t.item ->> 'alt_text'), ''),
         nullif(btrim(t.item ->> 'link_href'), ''),
         nullif(btrim(t.item ->> 'link_label'), ''),
         (t.ord - 1)::integer
  from jsonb_array_elements(p_slides) with ordinality as t(item, ord);

  insert into public.shop_featured_products (product_id, sort_order)
  select x, (ord - 1)::integer
  from unnest(coalesce(p_featured, '{}'::uuid[])) with ordinality as u(x, ord);

  update public.shop_slider_config
  set mode                = p_mode,
      show_featured_below = coalesce(p_show_featured_below, false),
      updated_at          = now(),
      updated_by          = (select auth.uid())
  where id;
end;
$$;

revoke execute on function public.admin_save_shop_slider(text, boolean, jsonb, uuid[]) from public, anon;
grant  execute on function public.admin_save_shop_slider(text, boolean, jsonb, uuid[]) to authenticated;

-- ---- carry the current banner over ----------------------------------------------

do $$
declare
  v_enabled  boolean;
  v_image    text;
  v_headline text;
  v_label    text;
  v_href     text;
  v_asset    uuid;
begin
  if exists (select 1 from public.shop_slides) then
    return;
  end if;

  select (value #>> '{}')::boolean into v_enabled from public.site_settings where key = 'shop_banner_enabled';
  if not coalesce(v_enabled, false) then
    return;
  end if;

  select value #>> '{}' into v_image    from public.site_settings where key = 'shop_banner_image_url';
  select value #>> '{}' into v_headline from public.site_settings where key = 'shop_banner_headline';
  select value #>> '{}' into v_label    from public.site_settings where key = 'shop_banner_cta_label';
  select value #>> '{}' into v_href     from public.site_settings where key = 'shop_banner_cta_href';

  select id into v_asset
  from public.media_assets
  where deleted_at is null
    and mime_type like 'image/%'
    and v_image like '%/storage/v1/object/public/' || bucket_id || '/' || object_path
  limit 1;

  if v_asset is null then
    raise notice 'shop banner image is not a library asset; slider starts off';
    return;
  end if;

  if not (coalesce(v_href, '') ~ '^/[^/]' and char_length(v_href) <= 300
          and char_length(btrim(coalesce(v_label, ''))) between 1 and 30) then
    v_href := null;
    v_label := null;
  end if;

  if not exists (select 1 from public.shop_slides) then
    insert into public.shop_slides (media_asset_id, headline, link_href, link_label, sort_order)
    values (v_asset, nullif(left(btrim(coalesce(v_headline, '')), 80), ''), v_href, nullif(btrim(v_label), ''), 0);
    update public.shop_slider_config set mode = 'media', updated_at = now() where id;
  end if;
end;
$$;
