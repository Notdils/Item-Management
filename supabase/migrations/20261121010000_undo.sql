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
create trigger voids_append_only before update or delete on public.voids
  for each row execute function public.tg_history_append_only();

alter table public.voids enable row level security;
create policy voids_read on public.voids for select to authenticated using (true);
grant select on public.voids to authenticated;
revoke insert, update, delete on public.voids from authenticated, anon;

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

revoke execute on function public.void_entry(bigint, bigint) from public, anon;
grant execute on function public.void_entry(bigint, bigint) to authenticated;

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
