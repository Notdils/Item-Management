-- OPSIONAL: data demo untuk presentasi. Jangan dijalankan di data produksi.
-- Butuh minimal satu profil PLSS (lihat bootstrap.sql). Semua laporan demo atas nama PLSS itu.
do $$
declare
  v_plss uuid := (select id from public.profiles where division = 'PLSS' order by created_at limit 1);
begin
  if v_plss is null then raise exception 'Buat akun PLSS dulu (bootstrap.sql)'; end if;
  perform set_config('request.jwt.claim.sub', v_plss::text, true);

  insert into public.locations (code, name) values
    ('DEMO-A1', 'Demo: lemari alat 1'), ('DEMO-A2', 'Demo: lemari alat 2'), ('DEMO-C1', 'Demo: rak bahan')
  on conflict (code) do nothing;

  perform public.report_item('Kunci torsi (demo)', 'AMBIL', null, null, now());
  perform public.move_stock('Cable ties 15 cm (demo)', 'MASUK',
    (select id from public.locations where code = 'DEMO-C1'), 100, 'pcs', null, now(), 'stok awal demo');
end $$;
