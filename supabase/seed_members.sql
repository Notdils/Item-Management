-- Buat (atau reset) akun anggota teknikal per divisi tim langsung dari SQL Editor.
-- 1. Isi v_password (kata sandi awal, minimal 8 karakter) dan sesuaikan daftar akun di bawah.
-- 2. Jalankan seluruh file (Ctrl+A, Run). Aman dijalankan ulang: akun yang sudah ada direset sandinya.
-- 3. Setelah berhasil, hapus kata sandi dari editor. Minta tiap anggota mengganti nama tampilannya di Akun.
-- Butuh migrasi 20261121020000_teams.sql.
do $$
declare
  v_password text := 'teknikal'; 
  r record;
  v_id uuid;
begin
  if length(v_password) < 8 or v_password like '[%' then
    raise exception 'Isi v_password dulu (minimal 8 karakter)';
  end if;

  for r in
    select * from (values
      -- email                          nama tampilan             divisi tim
      ('mechanical@example.com',        'Teknikal Mechanical',    'MECHANICAL'),
      ('electrical@example.com',        'Teknikal Electrical',    'ELECTRICAL')
    ) as t(email, full_name, team)
  loop
    select id into v_id from auth.users where email = lower(r.email);
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(r.email),
        extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'division', 'TEKNIKAL'),
        jsonb_build_object('full_name', r.full_name, 'email_verified', true), now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, 'email',
              jsonb_build_object('sub', v_id::text, 'email', lower(r.email), 'email_verified', true),
              now(), now(), now());
      raise notice 'Akun % dibuat', r.email;
    else
      update auth.users
         set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_id;
      raise notice 'Kata sandi % direset', r.email;
    end if;

    insert into public.profiles (id, full_name, division, team)
    values (v_id, r.full_name, 'TEKNIKAL', r.team::public.tech_team)
    on conflict (id) do update set division = 'TEKNIKAL', team = excluded.team;
  end loop;
end $$;

select u.email, p.full_name, p.division, p.team
  from auth.users u join public.profiles p on p.id = u.id
 order by p.division, p.team nulls last, p.full_name;
