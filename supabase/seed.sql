-- Data awal produksi Bengkel Anargya.
-- Cara pakai: Supabase SQL Editor, tempel seluruh isi file, Ctrl+A, lalu Run.
-- Aman dijalankan ulang: rak dan barang yang sudah ada tidak diduplikasi.
--
-- 1. Bersihkan data uji coba awal (rak DEMO-*, barang berakhiran "(demo)") beserta riwayatnya.
-- 2. Rak bengkel: RAK-A, RAK-B, RAK-C.
-- 3. Katalog barang awal. Stok tidak diisi di sini: PLSS mencatatnya lewat Opname setelah
--    hitung fisik, supaya angka di aplikasi sama dengan isi rak.

begin;

-- 1. Riwayat normalnya tidak bisa dihapus (trigger append-only),
--    jadi trigger dimatikan sementara hanya di dalam transaksi ini.
alter table public.reports     disable trigger reports_append_only;
alter table public.stock_moves disable trigger stock_moves_append_only;

delete from public.reports
 where item_id in (select id from public.items where name ilike '%(demo)%')
    or location_id in (select id from public.locations where code like 'DEMO-%');
delete from public.stock_moves
 where item_id in (select id from public.items where name ilike '%(demo)%')
    or location_id in (select id from public.locations where code like 'DEMO-%');
delete from public.item_merges
 where from_item_id in (select id from public.items where name ilike '%(demo)%')
    or into_item_id in (select id from public.items where name ilike '%(demo)%');
delete from public.items     where name ilike '%(demo)%';
delete from public.locations where code like 'DEMO-%';

alter table public.reports     enable trigger reports_append_only;
alter table public.stock_moves enable trigger stock_moves_append_only;

-- 2. Rak
insert into public.locations (code, name) values
  ('RAK-A', 'Rak A'),
  ('RAK-B', 'Rak B'),
  ('RAK-C', 'Rak C')
on conflict (code) do update set archived_at = null;

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

commit;

-- Cek hasil: 3 rak, katalog per jenis, dan trigger riwayat harus aktif (tgenabled = O)
select code, name from public.locations where archived_at is null order by code;
select kind, count(*) from public.items where archived_at is null group by kind;
select tgname, tgenabled from pg_trigger where tgname in ('reports_append_only', 'stock_moves_append_only');
