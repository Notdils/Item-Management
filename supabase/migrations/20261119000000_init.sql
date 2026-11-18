-- Bengkel Anargya: skema awal
-- Prinsip:
--   1. Riwayat adalah sumber kebenaran. Posisi alat dan jumlah stok dihitung dari riwayat
--      (view), tidak disimpan sebagai kolom yang bisa melenceng.
--   2. Riwayat append-only. Satu-satunya perubahan yang diizinkan adalah memindah item_id
--      saat PLSS menggabungkan barang duplikat, dan itu dicatat di item_merges.
--   3. Semua penulisan lewat fungsi (RPC) yang memvalidasi dan mengunci baris. Klien tidak
--      punya izin INSERT/UPDATE/DELETE langsung ke tabel riwayat.
--   4. Aturan yang bisa dijaga database, dijaga database (CHECK, FK, UNIQUE, trigger).

-- ---------------------------------------------------------------- tipe
create type public.division    as enum ('TEKNIKAL', 'PLSS');
create type public.item_kind   as enum ('ALAT', 'HABIS_PAKAI');
create type public.report_kind as enum ('TARUH', 'AMBIL');
create type public.stock_kind  as enum ('MASUK', 'PAKAI', 'OPNAME');

-- ---------------------------------------------------------------- tabel
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) between 2 and 80),
  division   public.division not null default 'TEKNIKAL',
  created_at timestamptz not null default now()
);

create table public.locations (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  name        text not null check (length(btrim(name)) between 2 and 80),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.items (
  id          bigint generated always as identity primary key,
  name        text not null check (length(btrim(name)) between 2 and 80),
  -- "Kunci  Ring 10" dan "kunci ring 10" dianggap barang yang sama
  name_key    text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  kind        public.item_kind not null,
  unit        text check (unit is null or length(btrim(unit)) between 1 and 12),
  archived_at timestamptz,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  constraint unit_only_for_consumables check (kind = 'HABIS_PAKAI' or unit is null)
);
-- nama unik hanya di antara barang aktif, supaya nama barang yang diarsip bisa dipakai lagi
create unique index items_name_key_active on public.items (name_key) where archived_at is null;

-- Laporan posisi alat (foto -> taruh/ambil)
create table public.reports (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references public.items (id),
  kind        public.report_kind not null,
  location_id bigint references public.locations (id),
  user_id     uuid not null references public.profiles (id),
  photo_path  text,
  taken_at    timestamptz not null,               -- jam di HP pelapor
  created_at  timestamptz not null default now(), -- jam server, dipakai untuk urutan
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m >= 0),
  note        text check (length(note) <= 280),
  constraint taruh_needs_location check ((kind = 'TARUH') = (location_id is not null)),
  constraint taruh_needs_photo    check (kind = 'AMBIL' or photo_path is not null),
  constraint gps_pair             check ((lat is null) = (lng is null))
);
create index reports_item_latest on public.reports (item_id, created_at desc, id desc);
create index reports_user        on public.reports (user_id, created_at desc);

-- Mutasi stok barang habis pakai
create table public.stock_moves (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references public.items (id),
  location_id bigint not null references public.locations (id),
  kind        public.stock_kind not null,
  qty_delta   integer not null,
  user_id     uuid not null references public.profiles (id),
  photo_path  text,
  taken_at    timestamptz not null,
  created_at  timestamptz not null default now(),
  note        text check (length(note) <= 280),
  constraint delta_sign check (
       (kind = 'MASUK' and qty_delta > 0)
    or (kind = 'PAKAI' and qty_delta < 0)
    or  kind = 'OPNAME'
  )
);
create index stock_moves_item_loc on public.stock_moves (item_id, location_id);

-- Jejak penggabungan barang duplikat
create table public.item_merges (
  id             bigint generated always as identity primary key,
  from_item_id   bigint not null references public.items (id),
  into_item_id   bigint not null references public.items (id),
  moved_reports  integer not null,
  moved_moves    integer not null,
  merged_by      uuid not null references public.profiles (id),
  merged_at      timestamptz not null default now(),
  constraint merge_distinct check (from_item_id <> into_item_id)
);

-- ---------------------------------------------------------------- trigger integritas
-- Laporan posisi hanya untuk ALAT, mutasi stok hanya untuk HABIS_PAKAI.
create function public.tg_check_item_kind() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_kind public.item_kind;
  v_want public.item_kind := tg_argv[0]::public.item_kind;
begin
  select kind into v_kind from public.items where id = new.item_id;
  if v_kind is distinct from v_want then
    raise exception 'Barang % bukan jenis %', new.item_id, v_want using errcode = '23514';
  end if;
  return new;
end $$;

create trigger reports_item_kind before insert or update of item_id on public.reports
  for each row execute function public.tg_check_item_kind('ALAT');
create trigger stock_moves_item_kind before insert or update of item_id on public.stock_moves
  for each row execute function public.tg_check_item_kind('HABIS_PAKAI');

-- Riwayat tidak bisa diubah atau dihapus. Pengecualian: item_id (penggabungan duplikat).
create function public.tg_history_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Riwayat tidak boleh dihapus' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'item_id') is distinct from (to_jsonb(old) - 'item_id') then
    raise exception 'Riwayat tidak boleh diubah' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger reports_append_only before update or delete on public.reports
  for each row execute function public.tg_history_append_only();
create trigger stock_moves_append_only before update or delete on public.stock_moves
  for each row execute function public.tg_history_append_only();

-- Profil dibuat otomatis saat akun dibuat. Divisi diambil dari app_metadata
-- (hanya bisa diisi admin/service role), bukan user_metadata yang bisa diisi pengguna.
create function public.tg_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, division)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'division')::public.division, 'TEKNIKAL')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_new_user();

-- GoTrue (admin.createUser) menyisipkan user dulu, lalu mengisi app_metadata dengan UPDATE terpisah.
-- Jadi divisi juga disinkronkan saat nilai division di app_metadata berubah.
create function public.tg_user_division_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.raw_app_meta_data ->> 'division') in ('TEKNIKAL', 'PLSS') then
    update public.profiles
       set division = (new.raw_app_meta_data ->> 'division')::public.division
     where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_division_changed after update of raw_app_meta_data on auth.users
  for each row
  when ((old.raw_app_meta_data ->> 'division') is distinct from (new.raw_app_meta_data ->> 'division'))
  execute function public.tg_user_division_changed();

-- ---------------------------------------------------------------- helper
create function public.is_plss() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and division = 'PLSS');
$$;

create function public.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Harus login' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

-- Cari barang aktif berdasarkan nama (dinormalisasi) dan kunci barisnya.
-- Kunci baris item menyerialkan laporan/mutasi untuk barang yang sama, jadi
-- "laporan terakhir" dan "sisa stok" selalu konsisten walau dua orang submit bersamaan.
create function public._lock_item(p_name text, p_kind public.item_kind, p_create boolean, p_unit text default null)
returns public.items
language plpgsql set search_path = '' as $$
declare
  v_key  text := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_item public.items;
begin
  if length(v_key) < 2 then
    raise exception 'Nama barang terlalu pendek' using errcode = '22023';
  end if;

  select * into v_item from public.items
   where name_key = v_key and archived_at is null
   for update;

  if not found then
    if not p_create then
      raise exception 'Barang "%" belum terdaftar', btrim(p_name) using errcode = 'P0002';
    end if;
    insert into public.items (name, kind, unit, created_by)
    values (regexp_replace(btrim(p_name), '\s+', ' ', 'g'), p_kind,
            case when p_kind = 'HABIS_PAKAI' then coalesce(nullif(btrim(p_unit), ''), 'pcs') end,
            auth.uid())
    on conflict (name_key) where archived_at is null do nothing;

    select * into v_item from public.items
     where name_key = v_key and archived_at is null
     for update;
  end if;

  if v_item.kind <> p_kind then
    raise exception '"%" terdaftar sebagai %', v_item.name,
      case v_item.kind when 'ALAT' then 'alat' else 'barang habis pakai' end
      using errcode = '23514';
  end if;
  return v_item;
end $$;

create function public._check_photo(p_path text, p_uid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_path is null then return; end if;
  if split_part(p_path, '/', 1) <> p_uid::text then
    raise exception 'Foto harus dari folder milik pelapor' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'photos' and name = p_path) then
    raise exception 'Foto belum terunggah' using errcode = '23503';
  end if;
end $$;

create function public._check_time(p_taken_at timestamptz) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_taken_at > now() + interval '5 minutes' or p_taken_at < now() - interval '7 days' then
    raise exception 'Waktu foto tidak wajar, cek jam di HP' using errcode = '22007';
  end if;
end $$;

create function public._check_location(p_location_id bigint) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_location_id is not null and not exists (
    select 1 from public.locations where id = p_location_id and archived_at is null
  ) then
    raise exception 'Lokasi tidak ditemukan' using errcode = '23503';
  end if;
end $$;

-- ---------------------------------------------------------------- RPC: lapor alat
create function public.report_item(
  p_item_name   text,
  p_kind        public.report_kind,
  p_location_id bigint           default null,
  p_photo_path  text             default null,
  p_taken_at    timestamptz      default now(),
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_accuracy_m  real             default null,
  p_note        text             default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_uid();
  v_item public.items;
  v_id   bigint;
begin
  perform public._check_time(p_taken_at);
  perform public._check_location(p_location_id);
  perform public._check_photo(p_photo_path, v_uid);
  v_item := public._lock_item(p_item_name, 'ALAT', true);

  insert into public.reports (item_id, kind, location_id, user_id, photo_path, taken_at, lat, lng, accuracy_m, note)
  values (v_item.id, p_kind, p_location_id, v_uid, p_photo_path, p_taken_at, p_lat, p_lng, p_accuracy_m,
          nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- RPC: mutasi stok
-- PAKAI: siapa saja, tidak boleh melebihi sisa.
-- MASUK: khusus PLSS, boleh mendaftarkan barang habis pakai baru.
-- OPNAME: khusus PLSS, p_qty = hasil hitung fisik, delta dihitung dari sisa tercatat.
create function public.move_stock(
  p_item_name   text,
  p_kind        public.stock_kind,
  p_location_id bigint,
  p_qty         integer,
  p_unit        text        default null,
  p_photo_path  text        default null,
  p_taken_at    timestamptz default now(),
  p_note        text        default null
) returns table (move_id bigint, qty_after integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.require_uid();
  v_plss    boolean := public.is_plss();
  v_item    public.items;
  v_current integer;
  v_delta   integer;
begin
  if p_kind in ('MASUK', 'OPNAME') and not v_plss then
    raise exception 'Hanya PLSS yang boleh menambah stok atau opname' using errcode = '42501';
  end if;
  if p_location_id is null then
    raise exception 'Lokasi wajib diisi' using errcode = '23502';
  end if;
  if p_qty is null or p_qty < 0 or (p_kind <> 'OPNAME' and p_qty = 0) then
    raise exception 'Jumlah tidak valid' using errcode = '22023';
  end if;
  perform public._check_time(p_taken_at);
  perform public._check_location(p_location_id);
  perform public._check_photo(p_photo_path, v_uid);
  v_item := public._lock_item(p_item_name, 'HABIS_PAKAI', p_kind = 'MASUK', p_unit);

  select coalesce(sum(m.qty_delta), 0)::integer into v_current
    from public.stock_moves m
   where m.item_id = v_item.id and m.location_id = p_location_id;

  v_delta := case p_kind
    when 'MASUK'  then p_qty
    when 'PAKAI'  then -p_qty
    when 'OPNAME' then p_qty - v_current
  end;

  if v_current + v_delta < 0 then
    raise exception 'Stok tidak cukup: sisa % %', v_current, coalesce(v_item.unit, '') using errcode = '23514';
  end if;

  insert into public.stock_moves (item_id, location_id, kind, qty_delta, user_id, photo_path, taken_at, note)
  values (v_item.id, p_location_id, p_kind, v_delta, v_uid, p_photo_path, p_taken_at, nullif(btrim(p_note), ''))
  returning id into move_id;
  qty_after := v_current + v_delta;
  return next;
end $$;

-- ---------------------------------------------------------------- RPC: admin PLSS
create function public.require_plss() returns uuid
language plpgsql stable set search_path = '' as $$
declare v_uid uuid := public.require_uid();
begin
  if not public.is_plss() then
    raise exception 'Khusus PLSS' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- Gabungkan barang duplikat: riwayat "from" dipindah ke "into", lalu "from" diarsip.
create function public.merge_items(p_from bigint, p_into bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_plss();
  v_from public.items;
  v_into public.items;
  v_r    integer;
  v_m    integer;
begin
  if p_from = p_into then
    raise exception 'Barang sama' using errcode = '22023';
  end if;
  -- kunci dengan urutan id supaya dua merge bersamaan tidak deadlock
  perform 1 from public.items where id in (p_from, p_into) order by id for update;
  select * into v_from from public.items where id = p_from and archived_at is null;
  select * into v_into from public.items where id = p_into and archived_at is null;
  if v_from.id is null or v_into.id is null then
    raise exception 'Barang tidak ditemukan atau sudah diarsip' using errcode = 'P0002';
  end if;
  if v_from.kind <> v_into.kind then
    raise exception 'Jenis barang berbeda, tidak bisa digabung' using errcode = '23514';
  end if;

  update public.reports     set item_id = p_into where item_id = p_from; get diagnostics v_r = row_count;
  update public.stock_moves set item_id = p_into where item_id = p_from; get diagnostics v_m = row_count;
  update public.items set archived_at = now() where id = p_from;
  insert into public.item_merges (from_item_id, into_item_id, moved_reports, moved_moves, merged_by)
  values (p_from, p_into, v_r, v_m, v_uid);
end $$;

create function public.archive_item(p_item bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  update public.items set archived_at = now() where id = p_item and archived_at is null;
  if not found then
    raise exception 'Barang tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

create function public.rename_item(p_item bigint, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  update public.items set name = regexp_replace(btrim(p_name), '\s+', ' ', 'g')
   where id = p_item and archived_at is null;
  if not found then
    raise exception 'Barang tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

create function public.set_division(p_user uuid, p_division public.division) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  if p_user = auth.uid() and p_division <> 'PLSS' then
    raise exception 'Tidak bisa menurunkan diri sendiri' using errcode = '22023';
  end if;
  update public.profiles set division = p_division where id = p_user;
end $$;

-- ---------------------------------------------------------------- view (RLS tetap berlaku)
-- Posisi terakhir tiap alat = laporan terbaru menurut jam server.
create view public.item_positions with (security_invoker = true) as
select distinct on (r.item_id)
  r.item_id,
  r.id          as report_id,
  r.kind,
  r.location_id,
  l.code        as location_code,
  l.name        as location_name,
  r.user_id,
  p.full_name   as user_name,
  r.photo_path,
  r.taken_at,
  r.created_at  as reported_at
from public.reports r
join public.profiles p on p.id = r.user_id
left join public.locations l on l.id = r.location_id
order by r.item_id, r.created_at desc, r.id desc;

-- Alat yang sedang dipegang. Lewat 12 jam = perlu diingatkan.
create view public.held_items with (security_invoker = true) as
select
  i.name,
  pos.*,
  now() - pos.reported_at                      as held_for,
  now() - pos.reported_at > interval '12 hours' as overdue
from public.item_positions pos
join public.items i on i.id = pos.item_id and i.archived_at is null
where pos.kind = 'AMBIL';

-- Sisa stok per barang per lokasi = jumlah semua mutasi.
create view public.stock_levels with (security_invoker = true) as
select
  m.item_id,
  i.name,
  i.unit,
  m.location_id,
  l.code               as location_code,
  l.name               as location_name,
  sum(m.qty_delta)::integer as qty,
  max(m.created_at)    as last_move_at
from public.stock_moves m
join public.items i on i.id = m.item_id and i.archived_at is null
join public.locations l on l.id = m.location_id
group by m.item_id, i.name, i.unit, m.location_id, l.code, l.name;

-- Ringkasan untuk halaman Cari.
create view public.item_overview with (security_invoker = true) as
select
  i.id,
  i.name,
  i.name_key,
  i.kind,
  i.unit,
  pos.kind          as last_kind,
  pos.location_code,
  pos.location_name,
  pos.user_name,
  pos.photo_path,
  pos.reported_at,
  st.qty_total,
  st.location_count
from public.items i
left join public.item_positions pos on pos.item_id = i.id
left join lateral (
  select sum(s.qty)::integer as qty_total, count(*)::integer as location_count
  from public.stock_levels s where s.item_id = i.id
) st on i.kind = 'HABIS_PAKAI'
where i.archived_at is null;

-- ---------------------------------------------------------------- RLS & hak akses
alter table public.profiles    enable row level security;
alter table public.locations   enable row level security;
alter table public.items       enable row level security;
alter table public.reports     enable row level security;
alter table public.stock_moves enable row level security;
alter table public.item_merges enable row level security;

-- Semua anggota yang login boleh membaca (tujuan aplikasi memang transparansi posisi barang).
create policy profiles_read    on public.profiles    for select to authenticated using (true);
create policy locations_read   on public.locations   for select to authenticated using (true);
create policy items_read       on public.items       for select to authenticated using (true);
create policy reports_read     on public.reports     for select to authenticated using (true);
create policy stock_moves_read on public.stock_moves for select to authenticated using (true);
create policy item_merges_read on public.item_merges for select to authenticated using ((select public.is_plss()));

-- Lokasi dikelola PLSS langsung lewat tabel (tidak ada riwayat yang perlu dijaga).
create policy locations_plss_insert on public.locations for insert to authenticated
  with check ((select public.is_plss()));
create policy locations_plss_update on public.locations for update to authenticated
  using ((select public.is_plss())) with check ((select public.is_plss()));

-- Pengguna boleh mengganti nama tampilannya sendiri, tidak boleh mengganti divisi.
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Tamu (anon) tidak boleh apa-apa.
revoke all on all tables in schema public from anon;
-- Supabase memberi EXECUTE ke anon & authenticated secara default. Cabut semua,
-- lalu buka hanya RPC publik di bawah. Helper (_lock_item, _check_*) jadi tidak bisa dipanggil klien.
revoke execute on all functions in schema public from anon, authenticated, public;

-- Tabel riwayat: tulis hanya lewat RPC.
revoke insert, update, delete on public.items, public.reports, public.stock_moves, public.item_merges from authenticated;
revoke delete on public.locations, public.profiles from authenticated;

grant execute on function
  public.is_plss(),
  public.report_item(text, public.report_kind, bigint, text, timestamptz, double precision, double precision, real, text),
  public.move_stock(text, public.stock_kind, bigint, integer, text, text, timestamptz, text),
  public.merge_items(bigint, bigint),
  public.archive_item(bigint),
  public.rename_item(bigint, text),
  public.set_division(uuid, public.division)
to authenticated;

-- ---------------------------------------------------------------- storage foto
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Unggah hanya ke folder sendiri: photos/<uid>/<file>. Tidak ada update/delete: foto bukti tidak bisa diganti.
create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_read_members on storage.objects for select to authenticated
  using (bucket_id = 'photos');
