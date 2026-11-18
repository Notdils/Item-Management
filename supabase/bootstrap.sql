-- Jalankan SETELAH migrasi. Aman dijalankan berkali-kali.
-- Ganti email di bawah dengan email akun PLSS pertama.

-- 1. Akun yang dibuat sebelum migrasi belum punya profil (trigger belum ada). Buatkan.
insert into public.profiles (id, full_name, division)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
       'TEKNIKAL'
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Jadikan akun pertama PLSS.
update public.profiles
   set division = 'PLSS'
 where id = (select id from auth.users where email = 'plss@example.com');

-- 3. Cek hasilnya.
select u.email, p.full_name, p.division
  from public.profiles p join auth.users u on u.id = p.id
 order by p.created_at;

-- Lokasi awal bisa ditambah lewat aplikasi: Akun -> Lokasi & rak.
