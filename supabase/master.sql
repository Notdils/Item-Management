-- =====================================================================
-- MASTER SQL: Bengkel Anargya (sistem manajemen barang bengkel)
-- =====================================================================
-- Isi: 4 migrasi berurutan + data awal (rak dan katalog barang) dalam satu file.
-- Untuk project Supabase BARU (kosong). Jalankan di SQL Editor: Ctrl+A, lalu Run.
-- Project yang sudah berjalan: jangan jalankan file ini; jalankan migrasi yang belum
-- dijalankan satu per satu dari supabase/migrations/.
--
-- Setelah ini (butuh kata sandi, jadi terpisah):
--   supabase/bootstrap.sql      jadikan akun pertama PLSS
--   supabase/seed_admin.sql     buat / reset akun admin PLSS
--   supabase/seed_members.sql   akun teknikal Mechanical / Electrical
--
-- Setiap query diberi komentar "-- >" (jenis + nama objek) dan baris "-- Catatan:"
-- kosong untuk penjelasan tambahan.
-- File ini DIBANGKITKAN dari file sumber; ubah file sumbernya, bukan file ini.
-- =====================================================================


-- #####################################################################
-- MIGRASI 1: skema inti (tabel, constraint, trigger, RPC, view, RLS, storage)
-- Sumber: supabase/migrations/20261119000000_init.sql
-- #####################################################################

-- > Tipe enum public.division
-- Catatan: 
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

-- > Tipe enum public.item_kind
-- Catatan: 
create type public.item_kind   as enum ('ALAT', 'HABIS_PAKAI');

-- > Tipe enum public.report_kind
-- Catatan: 
create type public.report_kind as enum ('TARUH', 'AMBIL');

-- > Tipe enum public.stock_kind
-- Catatan: 
create type public.stock_kind  as enum ('MASUK', 'PAKAI', 'OPNAME');

-- > Tabel public.profiles
-- Catatan: 
-- ---------------------------------------------------------------- tabel
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) between 2 and 80),
  division   public.division not null default 'TEKNIKAL',
  created_at timestamptz not null default now()
);

-- > Tabel public.locations
-- Catatan: 
create table public.locations (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  name        text not null check (length(btrim(name)) between 2 and 80),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

-- > Tabel public.items
-- Catatan: 
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

-- > Index unik items_name_key_active
-- Catatan: 
-- nama unik hanya di antara barang aktif, supaya nama barang yang diarsip bisa dipakai lagi
create unique index items_name_key_active on public.items (name_key) where archived_at is null;

-- > Tabel public.reports
-- Catatan: 
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

-- > Index reports_item_latest
-- Catatan: 
create index reports_item_latest on public.reports (item_id, created_at desc, id desc);

-- > Index reports_user
-- Catatan: 
create index reports_user        on public.reports (user_id, created_at desc);

-- > Tabel public.stock_moves
-- Catatan: 
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

-- > Index stock_moves_item_loc
-- Catatan: 
create index stock_moves_item_loc on public.stock_moves (item_id, location_id);

-- > Tabel public.item_merges
-- Catatan: 
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

-- > Fungsi public.tg_check_item_kind
-- Catatan: 
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

-- > Trigger reports_item_kind
-- Catatan: 
create trigger reports_item_kind before insert or update of item_id on public.reports
  for each row execute function public.tg_check_item_kind('ALAT');

-- > Trigger stock_moves_item_kind
-- Catatan: 
create trigger stock_moves_item_kind before insert or update of item_id on public.stock_moves
  for each row execute function public.tg_check_item_kind('HABIS_PAKAI');

-- > Fungsi public.tg_history_append_only
-- Catatan: 
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

-- > Trigger reports_append_only
-- Catatan: 
create trigger reports_append_only before update or delete on public.reports
  for each row execute function public.tg_history_append_only();

-- > Trigger stock_moves_append_only
-- Catatan: 
create trigger stock_moves_append_only before update or delete on public.stock_moves
  for each row execute function public.tg_history_append_only();

-- > Fungsi public.tg_new_user
-- Catatan: 
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

-- > Trigger on_auth_user_created
-- Catatan: 
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_new_user();

-- > Fungsi public.tg_user_division_changed
-- Catatan: 
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

-- > Trigger on_auth_user_division_changed
-- Catatan: 
create trigger on_auth_user_division_changed after update of raw_app_meta_data on auth.users
  for each row
  when ((old.raw_app_meta_data ->> 'division') is distinct from (new.raw_app_meta_data ->> 'division'))
  execute function public.tg_user_division_changed();

-- > Fungsi public.is_plss
-- Catatan: 
-- ---------------------------------------------------------------- helper
create function public.is_plss() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and division = 'PLSS');
$$;

-- > Fungsi public.require_uid
-- Catatan: 
create function public.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Harus login' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

-- > Fungsi public._lock_item
-- Catatan: 
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

-- > Fungsi public._check_photo
-- Catatan: 
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

-- > Fungsi public._check_time
-- Catatan: 
create function public._check_time(p_taken_at timestamptz) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_taken_at > now() + interval '5 minutes' or p_taken_at < now() - interval '7 days' then
    raise exception 'Waktu foto tidak wajar, cek jam di HP' using errcode = '22007';
  end if;
end $$;

-- > Fungsi public._check_location
-- Catatan: 
create function public._check_location(p_location_id bigint) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_location_id is not null and not exists (
    select 1 from public.locations where id = p_location_id and archived_at is null
  ) then
    raise exception 'Lokasi tidak ditemukan' using errcode = '23503';
  end if;
end $$;

-- > Fungsi public.report_item
-- Catatan: 
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

-- > Fungsi public.move_stock
-- Catatan: 
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

-- > Fungsi public.require_plss
-- Catatan: 
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

-- > Fungsi public.merge_items
-- Catatan: 
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

-- > Fungsi public.archive_item
-- Catatan: 
create function public.archive_item(p_item bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  update public.items set archived_at = now() where id = p_item and archived_at is null;
  if not found then
    raise exception 'Barang tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

-- > Fungsi public.rename_item
-- Catatan: 
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

-- > Fungsi public.set_division
-- Catatan: 
create function public.set_division(p_user uuid, p_division public.division) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  if p_user = auth.uid() and p_division <> 'PLSS' then
    raise exception 'Tidak bisa menurunkan diri sendiri' using errcode = '22023';
  end if;
  update public.profiles set division = p_division where id = p_user;
end $$;

-- > View public.item_positions
-- Catatan: 
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

-- > View public.held_items
-- Catatan: 
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

-- > View public.stock_levels
-- Catatan: 
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

-- > View public.item_overview
-- Catatan: 
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

-- > Aktifkan RLS di public.profiles
-- Catatan: 
-- ---------------------------------------------------------------- RLS & hak akses
alter table public.profiles    enable row level security;

-- > Aktifkan RLS di public.locations
-- Catatan: 
alter table public.locations   enable row level security;

-- > Aktifkan RLS di public.items
-- Catatan: 
alter table public.items       enable row level security;

-- > Aktifkan RLS di public.reports
-- Catatan: 
alter table public.reports     enable row level security;

-- > Aktifkan RLS di public.stock_moves
-- Catatan: 
alter table public.stock_moves enable row level security;

-- > Aktifkan RLS di public.item_merges
-- Catatan: 
alter table public.item_merges enable row level security;

-- > Policy RLS profiles_read pada public.profiles
-- Catatan: 
-- Semua anggota yang login boleh membaca (tujuan aplikasi memang transparansi posisi barang).
create policy profiles_read    on public.profiles    for select to authenticated using (true);

-- > Policy RLS locations_read pada public.locations
-- Catatan: 
create policy locations_read   on public.locations   for select to authenticated using (true);

-- > Policy RLS items_read pada public.items
-- Catatan: 
create policy items_read       on public.items       for select to authenticated using (true);

-- > Policy RLS reports_read pada public.reports
-- Catatan: 
create policy reports_read     on public.reports     for select to authenticated using (true);

-- > Policy RLS stock_moves_read pada public.stock_moves
-- Catatan: 
create policy stock_moves_read on public.stock_moves for select to authenticated using (true);

-- > Policy RLS item_merges_read pada public.item_merges
-- Catatan: 
create policy item_merges_read on public.item_merges for select to authenticated using ((select public.is_plss()));

-- > Policy RLS locations_plss_insert pada public.locations
-- Catatan: 
-- Lokasi dikelola PLSS langsung lewat tabel (tidak ada riwayat yang perlu dijaga).
create policy locations_plss_insert on public.locations for insert to authenticated
  with check ((select public.is_plss()));

-- > Policy RLS locations_plss_update pada public.locations
-- Catatan: 
create policy locations_plss_update on public.locations for update to authenticated
  using ((select public.is_plss())) with check ((select public.is_plss()));

-- > Policy RLS profiles_update_self pada public.profiles
-- Catatan: 
-- Pengguna boleh mengganti nama tampilannya sendiri, tidak boleh mengganti divisi.
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- > Izin: cabut update on public.profiles dari authenticated
-- Catatan: 
revoke update on public.profiles from authenticated;

-- > Izin: grant update (full_name) on public.profiles ke authenticated
-- Catatan: 
grant update (full_name) on public.profiles to authenticated;

-- > Izin: cabut all on all tables in schema public dari anon
-- Catatan: 
-- Tamu (anon) tidak boleh apa-apa.
revoke all on all tables in schema public from anon;

-- > Izin: cabut execute on all functions in schema public dari anon, authenticated, public
-- Catatan: 
-- Supabase memberi EXECUTE ke anon & authenticated secara default. Cabut semua,
-- lalu buka hanya RPC publik di bawah. Helper (_lock_item, _check_*) jadi tidak bisa dipanggil klien.
revoke execute on all functions in schema public from anon, authenticated, public;

-- > Izin: cabut insert, update, delete on public.items, public.reports, public.stock_m dari authenticated
-- Catatan: 
-- Tabel riwayat: tulis hanya lewat RPC.
revoke insert, update, delete on public.items, public.reports, public.stock_moves, public.item_merges from authenticated;

-- > Izin: cabut delete on public.locations, public.profiles dari authenticated
-- Catatan: 
revoke delete on public.locations, public.profiles from authenticated;

-- > Izin: grant execute on function public.is_plss(), public.report_item(text, public. ke authenticated
-- Catatan: 
grant execute on function
  public.is_plss(),
  public.report_item(text, public.report_kind, bigint, text, timestamptz, double precision, double precision, real, text),
  public.move_stock(text, public.stock_kind, bigint, integer, text, text, timestamptz, text),
  public.merge_items(bigint, bigint),
  public.archive_item(bigint),
  public.rename_item(bigint, text),
  public.set_division(uuid, public.division)
to authenticated;

-- > Isi data storage.buckets
-- Catatan: 
-- ---------------------------------------------------------------- storage foto
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- > Policy RLS photos_insert_own pada storage.objects
-- Catatan: 
-- Unggah hanya ke folder sendiri: photos/<uid>/<file>. Tidak ada update/delete: foto bukti tidak bisa diganti.
create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- > Policy RLS photos_read_members pada storage.objects
-- Catatan: 
create policy photos_read_members on storage.objects for select to authenticated
  using (bucket_id = 'photos');


-- #####################################################################
-- MIGRASI 2: GRANT eksplisit untuk Data API (Supabase 2026)
-- Sumber: supabase/migrations/20261121000000_explicit_grants.sql
-- #####################################################################

-- > Izin: grant usage on schema public ke authenticated
-- Catatan: 
-- Izin eksplisit untuk role `authenticated`.
-- Project Supabase baru tidak lagi memberi izin otomatis ke anon/authenticated untuk tabel baru
-- di schema public. Tanpa ini, query apa pun dari aplikasi gagal dengan
-- "permission denied for table profiles" (gejala: halaman blank / redirect loop / "Aplikasi gagal dimuat").
-- RLS tetap menentukan baris mana yang boleh dibaca/diubah. Aman dijalankan berkali-kali.

grant usage on schema public to authenticated;

-- > Izin: grant select on public.profiles, public.locations, public.items, public.repo ke authenticated
-- Catatan: 
-- Baca: semua tabel dan view aplikasi (dibatasi lagi oleh RLS)
grant select on
  public.profiles,
  public.locations,
  public.items,
  public.reports,
  public.stock_moves,
  public.item_merges,
  public.item_positions,
  public.held_items,
  public.stock_levels,
  public.item_overview
to authenticated;

-- > Izin: grant insert, update on public.locations ke authenticated
-- Catatan: 
-- Tulis langsung hanya untuk: lokasi (PLSS, dijaga RLS) dan nama tampilan sendiri.
-- Riwayat (reports, stock_moves) dan barang tetap hanya lewat RPC.
grant insert, update on public.locations to authenticated;

-- > Izin: grant update (full_name) on public.profiles ke authenticated
-- Catatan: 
grant update (full_name) on public.profiles to authenticated;

-- > Izin: cabut all on all tables in schema public dari anon
-- Catatan: 
-- Tamu tetap tidak boleh apa-apa
revoke all on all tables in schema public from anon;


-- #####################################################################
-- MIGRASI 3: batalkan laporan lewat tabel voids
-- Sumber: supabase/migrations/20261121010000_undo.sql
-- #####################################################################

-- > Tabel public.voids
-- Catatan: 
-- Batalkan laporan (undo) tanpa menghapus riwayat.
-- Riwayat tetap append-only: pembatalan dicatat sebagai baris baru di tabel voids,
-- lalu view posisi/stok mengabaikan laporan yang dibatalkan.
-- Aturan: hanya pelapor sendiri, maksimal 5 menit setelah kirim, laporan alat hanya kalau
-- masih yang terbaru untuk barang itu, dan mutasi stok hanya kalau stok tidak jadi minus.

create table public.voids (
  id         bigint generated always as identity primary key,
  report_id  bigint unique references public.reports (id),
  move_id    bigint unique references public.stock_moves (id),
  voided_by  uuid not null references public.profiles (id),
  voided_at  timestamptz not null default now(),
  constraint void_one_target check (num_nonnulls(report_id, move_id) = 1)
);

-- > Trigger voids_append_only
-- Catatan: 
create trigger voids_append_only before update or delete on public.voids
  for each row execute function public.tg_history_append_only();

-- > Aktifkan RLS di public.voids
-- Catatan: 
alter table public.voids enable row level security;

-- > Policy RLS voids_read pada public.voids
-- Catatan: 
create policy voids_read on public.voids for select to authenticated using (true);

-- > Izin: grant select on public.voids ke authenticated
-- Catatan: 
grant select on public.voids to authenticated;

-- > Izin: cabut insert, update, delete on public.voids dari authenticated, anon
-- Catatan: 
revoke insert, update, delete on public.voids from authenticated, anon;

-- > Fungsi public.void_entry
-- Catatan: 
create function public.void_entry(p_report_id bigint default null, p_move_id bigint default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_uid();
  v_rep   public.reports;
  v_move  public.stock_moves;
  v_qty   integer;
begin
  if num_nonnulls(p_report_id, p_move_id) <> 1 then
    raise exception 'Pilih satu laporan untuk dibatalkan' using errcode = '22023';
  end if;

  if p_report_id is not null then
    select * into v_rep from public.reports where id = p_report_id;
    if not found or v_rep.user_id <> v_uid then
      raise exception 'Laporan tidak ditemukan' using errcode = '42501';
    end if;
    perform 1 from public.items where id = v_rep.item_id for update;  -- kunci barang: aman dari laporan bersamaan
    if exists (select 1 from public.voids where report_id = p_report_id) then
      raise exception 'Laporan ini sudah dibatalkan' using errcode = '23505';
    end if;
    if v_rep.created_at < now() - interval '5 minutes' then
      raise exception 'Batas membatalkan 5 menit sudah lewat. Kirim laporan baru untuk membetulkan.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.reports x
       where x.item_id = v_rep.item_id and x.id <> v_rep.id
         and (x.created_at, x.id) > (v_rep.created_at, v_rep.id)
         and not exists (select 1 from public.voids v where v.report_id = x.id)
    ) then
      raise exception 'Sudah ada laporan lebih baru untuk barang ini' using errcode = '22023';
    end if;
    insert into public.voids (report_id, voided_by) values (p_report_id, v_uid);
  else
    select * into v_move from public.stock_moves where id = p_move_id;
    if not found or v_move.user_id <> v_uid then
      raise exception 'Laporan tidak ditemukan' using errcode = '42501';
    end if;
    perform 1 from public.items where id = v_move.item_id for update;
    if exists (select 1 from public.voids where move_id = p_move_id) then
      raise exception 'Laporan ini sudah dibatalkan' using errcode = '23505';
    end if;
    if v_move.created_at < now() - interval '5 minutes' then
      raise exception 'Batas membatalkan 5 menit sudah lewat. Kirim laporan baru untuk membetulkan.' using errcode = '22023';
    end if;
    select coalesce(sum(m.qty_delta), 0)::integer into v_qty
      from public.stock_moves m
     where m.item_id = v_move.item_id and m.location_id = v_move.location_id
       and not exists (select 1 from public.voids v where v.move_id = m.id);
    if v_qty - v_move.qty_delta < 0 then
      raise exception 'Tidak bisa dibatalkan: stoknya sudah terpakai' using errcode = '23514';
    end if;
    insert into public.voids (move_id, voided_by) values (p_move_id, v_uid);
  end if;
end $$;

-- > Izin: cabut execute on function public.void_entry(bigint, bigint) dari public, anon
-- Catatan: 
revoke execute on function public.void_entry(bigint, bigint) from public, anon;

-- > Izin: grant execute on function public.void_entry(bigint, bigint) ke authenticated
-- Catatan: 
grant execute on function public.void_entry(bigint, bigint) to authenticated;

-- > View public.item_positions
-- Catatan: 
-- View dan sisa stok mengabaikan laporan yang dibatalkan (kolom tidak berubah)
create or replace view public.item_positions with (security_invoker = true) as
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
where not exists (select 1 from public.voids v where v.report_id = r.id)
order by r.item_id, r.created_at desc, r.id desc;

-- > View public.stock_levels
-- Catatan: 
create or replace view public.stock_levels with (security_invoker = true) as
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
where not exists (select 1 from public.voids v where v.move_id = m.id)
group by m.item_id, i.name, i.unit, m.location_id, l.code, l.name;

-- > Fungsi public.move_stock
-- Catatan: 
-- Sisa stok di dalam move_stock juga mengabaikan mutasi yang dibatalkan
create or replace function public.move_stock(
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
   where m.item_id = v_item.id and m.location_id = p_location_id
     and not exists (select 1 from public.voids v where v.move_id = m.id);

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


-- #####################################################################
-- MIGRASI 4: divisi tim teknikal (Mechanical / Electrical)
-- Sumber: supabase/migrations/20261121020000_teams.sql
-- #####################################################################

-- > Tipe enum public.tech_team
-- Catatan: 
-- Divisi tim untuk anggota teknikal: Mechanical atau Electrical
-- (struktur Anargya: Mechanical, Electrical, Non-technical; non-technical = PLSS di aplikasi ini).
-- Diisi PLSS saat membuat akun atau dari halaman Anggota. PLSS tidak punya divisi tim.

create type public.tech_team as enum ('MECHANICAL', 'ELECTRICAL');

-- > Kolom baru team di public.profiles
-- Catatan: 
alter table public.profiles add column team public.tech_team;

-- > Constraint team_only_teknikal di public.profiles
-- Catatan: 
alter table public.profiles add constraint team_only_teknikal check (division = 'TEKNIKAL' or team is null);

-- > Fungsi public.set_division
-- Catatan: 
-- Jadikan PLSS sekaligus mengosongkan divisi tim
create or replace function public.set_division(p_user uuid, p_division public.division) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  if p_user = auth.uid() and p_division <> 'PLSS' then
    raise exception 'Tidak bisa menurunkan diri sendiri' using errcode = '22023';
  end if;
  update public.profiles
     set division = p_division,
         team = case when p_division = 'PLSS' then null else team end
   where id = p_user;
end $$;

-- > Fungsi public.tg_user_division_changed
-- Catatan: 
-- Sinkron divisi dari app_metadata (admin.createUser) juga mengosongkan tim kalau jadi PLSS
create or replace function public.tg_user_division_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.raw_app_meta_data ->> 'division') in ('TEKNIKAL', 'PLSS') then
    update public.profiles
       set division = (new.raw_app_meta_data ->> 'division')::public.division,
           team = case when new.raw_app_meta_data ->> 'division' = 'PLSS' then null else team end
     where id = new.id;
  end if;
  return new;
end $$;

-- > Fungsi public.set_team
-- Catatan: 
create function public.set_team(p_user uuid, p_team public.tech_team) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  update public.profiles set team = p_team where id = p_user and division = 'TEKNIKAL';
  if not found then
    raise exception 'Divisi tim hanya untuk anggota teknikal' using errcode = '22023';
  end if;
end $$;

-- > Izin: cabut execute on function public.set_team(uuid, public.tech_team) dari public, anon
-- Catatan: 
revoke execute on function public.set_team(uuid, public.tech_team) from public, anon;

-- > Izin: grant execute on function public.set_team(uuid, public.tech_team) ke authenticated
-- Catatan: 
grant execute on function public.set_team(uuid, public.tech_team) to authenticated;


-- #####################################################################
-- DATA AWAL: rak RAK-A sampai RAK-C dan katalog barang
-- Sumber: supabase/seed.sql
-- #####################################################################

-- > Mulai transaksi data awal
-- Catatan: 
-- Data awal produksi Bengkel Anargya.
-- Cara pakai: Supabase SQL Editor, tempel seluruh isi file, Ctrl+A, lalu Run.
-- Aman dijalankan ulang: rak dan barang yang sudah ada tidak diduplikasi.
--
-- 1. Bersihkan data uji coba awal (rak DEMO-*, barang berakhiran "(demo)") beserta riwayatnya.
-- 2. Rak bengkel: RAK-A, RAK-B, RAK-C.
-- 3. Katalog barang awal. Stok tidak diisi di sini: PLSS mencatatnya lewat Opname setelah
--    hitung fisik, supaya angka di aplikasi sama dengan isi rak.

begin;

-- > Matikan sementara trigger reports_append_only di public.reports
-- Catatan: 
-- 1. Riwayat normalnya tidak bisa dihapus (trigger append-only),
--    jadi trigger dimatikan sementara hanya di dalam transaksi ini.
alter table public.reports     disable trigger reports_append_only;

-- > Matikan sementara trigger stock_moves_append_only di public.stock_moves
-- Catatan: 
alter table public.stock_moves disable trigger stock_moves_append_only;

-- > Hapus data uji di public.reports
-- Catatan: 
delete from public.reports
 where item_id in (select id from public.items where name ilike '%(demo)%')
    or location_id in (select id from public.locations where code like 'DEMO-%');

-- > Hapus data uji di public.stock_moves
-- Catatan: 
delete from public.stock_moves
 where item_id in (select id from public.items where name ilike '%(demo)%')
    or location_id in (select id from public.locations where code like 'DEMO-%');

-- > Hapus data uji di public.item_merges
-- Catatan: 
delete from public.item_merges
 where from_item_id in (select id from public.items where name ilike '%(demo)%')
    or into_item_id in (select id from public.items where name ilike '%(demo)%');

-- > Hapus data uji di public.items
-- Catatan: 
delete from public.items     where name ilike '%(demo)%';

-- > Hapus data uji di public.locations
-- Catatan: 
delete from public.locations where code like 'DEMO-%';

-- > Nyalakan lagi trigger reports_append_only di public.reports
-- Catatan: 
alter table public.reports     enable trigger reports_append_only;

-- > Nyalakan lagi trigger stock_moves_append_only di public.stock_moves
-- Catatan: 
alter table public.stock_moves enable trigger stock_moves_append_only;

-- > Isi data public.locations
-- Catatan: 
-- 2. Rak
insert into public.locations (code, name) values
  ('RAK-A', 'Rak A'),
  ('RAK-B', 'Rak B'),
  ('RAK-C', 'Rak C')
on conflict (code) do update set archived_at = null;

-- > Isi data public.items
-- Catatan: 
-- 3. Katalog barang awal (nama bisa diganti / diarsip PLSS di Akun > Daftar barang)
insert into public.items (name, kind, unit)
select v.name, v.kind::public.item_kind, v.unit
from (values
  -- Alat: dilacak per unit (siapa pegang, di rak mana)
  ('Kunci ring set 8-24 mm',  'ALAT', null),
  ('Kunci pas set 8-24 mm',   'ALAT', null),
  ('Kunci sok set',           'ALAT', null),
  ('Kunci L set',             'ALAT', null),
  ('Kunci torsi',             'ALAT', null),
  ('Obeng plus',              'ALAT', null),
  ('Obeng minus',             'ALAT', null),
  ('Tang potong',             'ALAT', null),
  ('Tang lancip',             'ALAT', null),
  ('Tang crimping',           'ALAT', null),
  ('Tang kupas kabel',        'ALAT', null),
  ('Multimeter',              'ALAT', null),
  ('Clamp meter',             'ALAT', null),
  ('Solder',                  'ALAT', null),
  ('Heat gun',                'ALAT', null),
  ('Bor listrik',             'ALAT', null),
  ('Gerinda tangan',          'ALAT', null),
  ('Jangka sorong',           'ALAT', null),
  -- Habis pakai: dilacak jumlahnya per rak
  ('Cable ties 15 cm',        'HABIS_PAKAI', 'pcs'),
  ('Heatshrink 5 mm',         'HABIS_PAKAI', 'm'),
  ('Selotip listrik',         'HABIS_PAKAI', 'roll'),
  ('Timah solder',            'HABIS_PAKAI', 'roll'),
  ('Kabel 2,5 mm',            'HABIS_PAKAI', 'm'),
  ('Baut M5',                 'HABIS_PAKAI', 'pcs'),
  ('Mur M5',                  'HABIS_PAKAI', 'pcs'),
  ('Amplas',                  'HABIS_PAKAI', 'lembar')
) as v(name, kind, unit)
where not exists (
  select 1 from public.items i
  where i.archived_at is null and i.name_key = lower(regexp_replace(btrim(v.name), '\s+', ' ', 'g'))
);

-- > Selesai transaksi data awal
-- Catatan: 
commit;

-- > Cek hasil
-- Catatan: 
-- Cek hasil: 3 rak, katalog per jenis, dan trigger riwayat harus aktif (tgenabled = O)
select code, name from public.locations where archived_at is null order by code;

-- > Cek hasil
-- Catatan: 
select kind, count(*) from public.items where archived_at is null group by kind;

-- > Cek hasil
-- Catatan: 
select tgname, tgenabled from pg_trigger where tgname in ('reports_append_only', 'stock_moves_append_only');
