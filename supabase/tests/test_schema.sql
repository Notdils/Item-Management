-- Uji skema: jalankan setelah stub + migrasi. Gagal = ERROR, lulus = NOTICE "OK".
\set ON_ERROR_STOP on
set client_min_messages = notice;

create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then
      raise exception 'Kode error salah untuk [%]: dapat % (%), harap %', p_sql, sqlstate, sqlerrm, p_code;
    end if;
    raise notice 'OK error %: %', p_code, sqlerrm;
    return;
  end;
  raise exception 'Harusnya gagal: %', p_sql;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated;

-- data awal (sebagai admin)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'plss@x.id', '{"full_name":"Rani PLSS"}', '{"division":"PLSS"}'),
  ('00000000-0000-0000-0000-00000000000b', 'tek@x.id',  '{"full_name":"Budi Teknikal"}', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'hack@x.id', '{"full_name":"Hacker","division":"PLSS"}', '{}');
insert into public.locations (code, name) values ('RAK-A1', 'Lemari Alat'), ('RAK-C1', 'Rak Bahan');
insert into storage.objects (bucket_id, name) values
  ('photos', '00000000-0000-0000-0000-00000000000b/1.jpg'),
  ('photos', '00000000-0000-0000-0000-00000000000a/1.jpg');

do $$ begin
  assert (select division from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'TEKNIKAL',
    'division dari user_metadata tidak boleh dipakai';
  raise notice 'OK profil otomatis, divisi dari app_metadata saja';
end $$;

-- Pola GoTrue admin.createUser: insert tanpa division, lalu update app_metadata
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000d', 'baru@x.id', '{"full_name":"Sari"}');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"division":"PLSS"}' where id = '00000000-0000-0000-0000-00000000000d';
do $$ begin
  assert (select division from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 'PLSS', 'division harus tersinkron';
  raise notice 'OK divisi tersinkron saat app_metadata diisi belakangan';
end $$;

-- ===== sebagai teknikal
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

select pg_temp.expect_error($$insert into public.reports (item_id, kind, user_id, taken_at) values (1,'AMBIL','00000000-0000-0000-0000-00000000000b',now())$$, '42501');
select pg_temp.expect_error($$insert into public.locations (code, name) values ('RAK-Z9','x')$$, '42501');
select pg_temp.expect_error($$select public._lock_item('x','ALAT',true)$$, '42501');
select pg_temp.expect_error($$update public.profiles set division='PLSS' where id=auth.uid()$$, '42501');
-- izin eksplisit: baca profil dan ganti nama sendiri harus jalan (project Supabase baru tanpa izin default)
update public.profiles set full_name = 'Budi T.' where id = auth.uid();
do $$ begin
  assert (select full_name from public.profiles where id = auth.uid()) = 'Budi T.', 'ganti nama sendiri harus bisa';
  raise notice 'OK izin eksplisit: baca profil + ganti nama sendiri';
end $$;

-- lapor TARUH tanpa lokasi/foto ditolak constraint
select pg_temp.expect_error($$select public.report_item('Kunci ring 10', 'TARUH')$$, '23514');
-- foto milik orang lain ditolak
select pg_temp.expect_error($$select public.report_item('Kunci ring 10', 'TARUH', 1, '00000000-0000-0000-0000-00000000000a/1.jpg')$$, '42501');
-- foto yang belum diunggah ditolak
select pg_temp.expect_error($$select public.report_item('Kunci ring 10', 'TARUH', 1, '00000000-0000-0000-0000-00000000000b/nope.jpg')$$, '23503');
-- jam HP ngawur ditolak
select pg_temp.expect_error($$select public.report_item('Kunci ring 10', 'AMBIL', null, null, now() + interval '1 day')$$, '22007');

select public.report_item('Kunci ring 10', 'TARUH', 1, '00000000-0000-0000-0000-00000000000b/1.jpg', now(), -7.28, 112.79, 12);
-- nama beda spasi/kapital = barang yang sama
select public.report_item('  kunci   RING 10 ', 'AMBIL');
do $$ begin
  assert (select count(*) from public.items) = 1, 'harus 1 barang';
  assert (select kind from public.item_positions) = 'AMBIL', 'posisi terakhir harus AMBIL';
  assert (select count(*) from public.held_items) = 1, 'harus ada 1 yang dipegang';
  raise notice 'OK normalisasi nama + posisi terakhir';
end $$;

-- riwayat tidak bisa diubah / dihapus walau lewat tabel
select pg_temp.expect_error($$update public.reports set kind='TARUH'$$, '42501');
select pg_temp.expect_error($$delete from public.reports$$, '42501');

-- teknikal tidak boleh menambah stok, juga tidak boleh pakai barang habis pakai yang belum terdaftar
select pg_temp.expect_error($$select * from public.move_stock('Cable ties', 'MASUK', 2, 100)$$, '42501');
select pg_temp.expect_error($$select * from public.move_stock('Cable ties', 'PAKAI', 2, 1)$$, 'P0002');
reset role;

-- ===== sebagai PLSS
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select * from public.move_stock('Cable ties 15 cm', 'MASUK', 2, 140, 'pcs');
-- alat tidak bisa dipakai sebagai stok
select pg_temp.expect_error($$select * from public.move_stock('kunci ring 10', 'MASUK', 2, 5)$$, '23514');
insert into public.locations (code, name) values ('RAK-C2', 'Rak Bahan 2');
select pg_temp.expect_error($$insert into public.locations (code, name) values ('rak c2', 'salah format')$$, '23514');
reset role;

-- ===== teknikal pakai stok
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select * from public.move_stock('cable ties 15 cm', 'PAKAI', 2, 10);
select pg_temp.expect_error($$select * from public.move_stock('cable ties 15 cm', 'PAKAI', 2, 999)$$, '23514');
-- stok di lokasi lain dihitung terpisah
select pg_temp.expect_error($$select * from public.move_stock('cable ties 15 cm', 'PAKAI', 1, 1)$$, '23514');
-- barang habis pakai tidak bisa dilaporkan sebagai alat
select pg_temp.expect_error($$select public.report_item('Cable ties 15 cm', 'AMBIL')$$, '23514');
do $$ begin
  assert (select qty from public.stock_levels where item_id = (select id from public.items where name_key='cable ties 15 cm')) = 130, 'sisa harus 130';
  raise notice 'OK stok 140 - 10 = 130';
end $$;
select pg_temp.expect_error($$select public.merge_items(1, 2)$$, '42501');
reset role;

-- ===== PLSS opname & merge
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select * from public.move_stock('Cable ties 15 cm', 'OPNAME', 2, 125);
do $$ begin
  assert (select qty from public.stock_levels where location_code='RAK-C2' or location_id=2 limit 1) = 125, 'opname harus jadi 125';
  assert (select qty_delta from public.stock_moves order by id desc limit 1) = -5, 'delta opname -5';
  raise notice 'OK opname mencatat selisih -5';
end $$;

select public.report_item('Kunci ring 10mm', 'TARUH', 1, '00000000-0000-0000-0000-00000000000a/1.jpg');
select pg_temp.expect_error($$select public.merge_items((select id from public.items where name_key='kunci ring 10'), (select id from public.items where name_key='cable ties 15 cm'))$$, '23514');
select public.merge_items((select id from public.items where name_key='kunci ring 10mm'), (select id from public.items where name_key='kunci ring 10'));
do $$ begin
  assert (select count(*) from public.reports where item_id = (select id from public.items where name_key='kunci ring 10' and archived_at is null)) = 3, 'semua laporan pindah';
  assert (select count(*) from public.item_merges) = 1, 'merge tercatat';
  assert (select kind from public.item_positions where item_id = (select id from public.items where name_key='kunci ring 10' and archived_at is null)) = 'TARUH', 'posisi terakhir TARUH';
  assert (select count(*) from public.held_items) = 0, 'tidak ada yang dipegang';
  raise notice 'OK merge memindah riwayat dan mencatat jejak';
end $$;
-- nama barang yang diarsip bisa dipakai lagi
select public.report_item('Kunci ring 10mm', 'AMBIL');
select pg_temp.expect_error($$select public.set_division(auth.uid(), 'TEKNIKAL')$$, '22023');
select public.set_division('00000000-0000-0000-0000-00000000000b', 'PLSS');
reset role;

-- ===== anon tidak bisa apa-apa
set role anon;
select pg_temp.expect_error($$select * from public.items$$, '42501');
select pg_temp.expect_error($$select public.report_item('x','AMBIL')$$, '42501');
reset role;

-- ===== batalkan laporan (undo): append-only lewat tabel voids
insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-00000000000b/u1.jpg');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.report_item('Obeng undo', 'TARUH', 1, '00000000-0000-0000-0000-00000000000b/u1.jpg');
select public.report_item('Obeng undo', 'AMBIL');
-- laporan lama (bukan yang terbaru) tidak boleh dibatalkan
select pg_temp.expect_error($$select public.void_entry(p_report_id => (select min(id) from public.reports where item_id = (select id from public.items where name_key='obeng undo')))$$, '22023');
select public.void_entry(p_report_id => (select max(id) from public.reports where item_id = (select id from public.items where name_key='obeng undo')));
do $$ begin
  assert (select kind from public.item_positions where item_id = (select id from public.items where name_key='obeng undo')) = 'TARUH', 'setelah undo AMBIL, posisi kembali TARUH';
  assert (select count(*) from public.reports where item_id = (select id from public.items where name_key='obeng undo')) = 2, 'riwayat tidak dihapus';
  raise notice 'OK undo laporan alat: posisi kembali, riwayat tetap';
end $$;
select pg_temp.expect_error($$select public.void_entry(p_report_id => (select max(id) from public.reports where item_id = (select id from public.items where name_key='obeng undo')))$$, '23505');
select pg_temp.expect_error($$delete from public.voids$$, '42501');
-- laporan orang lain tidak bisa dibatalkan
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($$select public.void_entry(p_report_id => (select min(id) from public.reports where item_id = (select id from public.items where name_key='obeng undo')))$$, '42501');
-- undo mutasi stok: MASUK lalu PAKAI; MASUK tidak bisa dibatalkan kalau stok jadi minus
select public.move_stock('Baut undo', 'MASUK', 1, 10, 'pcs');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.move_stock('Baut undo', 'PAKAI', 1, 4);
select public.void_entry(p_move_id => (select max(id) from public.stock_moves));
do $$ begin
  assert (select qty from public.stock_levels where item_id = (select id from public.items where name_key='baut undo')) = 10, 'undo PAKAI mengembalikan stok';
  raise notice 'OK undo pakai: stok kembali 10';
end $$;
select public.move_stock('Baut undo', 'PAKAI', 1, 8);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($$select public.void_entry(p_move_id => (select min(id) from public.stock_moves where item_id = (select id from public.items where name_key='baut undo')))$$, '23514');
reset role;
do $$ begin raise notice 'OK undo: hanya pelapor, hanya terbaru, tidak bikin minus, tidak bisa dihapus'; end $$;

-- ===== divisi tim teknikal (Mechanical / Electrical)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.set_division('00000000-0000-0000-0000-00000000000b', 'TEKNIKAL');
select public.set_team('00000000-0000-0000-0000-00000000000b', 'ELECTRICAL');
do $$ begin
  assert (select team from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'ELECTRICAL', 'tim tersimpan';
end $$;
select pg_temp.expect_error($$select public.set_team('00000000-0000-0000-0000-00000000000a', 'MECHANICAL')$$, '22023'); -- PLSS tidak punya tim
select public.set_division('00000000-0000-0000-0000-00000000000b', 'PLSS');
do $$ begin
  assert (select team from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is null, 'jadi PLSS: tim dikosongkan';
  raise notice 'OK divisi tim: hanya teknikal, dikosongkan saat jadi PLSS';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
reset role;
-- ===== konkurensi: kunci item menyerialkan pemakaian stok (dicek terpisah di run_tests.sh)
\echo 'SEMUA TES LULUS'
