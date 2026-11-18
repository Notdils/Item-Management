-- Buat (atau reset) akun admin PLSS langsung dari SQL Editor.
-- 1. Ganti tiga nilai di bawah.  2. Jalankan seluruh file (jangan diblok).
-- Aman dijalankan berkali-kali: kalau email sudah ada, kata sandi direset dan divisinya dijadikan PLSS.
-- Setelah berhasil, HAPUS kata sandi dari editor (jangan disimpan sebagai saved query).
do $$
declare
  v_email    text := 'plss@example.com';   -- email login
  v_password text := '[KATA_SANDI_MIN_8]'; -- kata sandi login
  v_name     text := 'Admin PLSS';         -- nama tampilan
  v_id       uuid;
begin
  if length(v_password) < 8 or v_password like '[%' then
    raise exception 'Isi v_password dulu (minimal 8 karakter)';
  end if;

  select id into v_id from auth.users where email = lower(v_email);

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      -- GoTrue gagal membaca baris yang kolom token-nya NULL, jadi diisi string kosong
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(v_email),
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'division', 'PLSS'),
      jsonb_build_object('full_name', v_name, 'email_verified', true), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, 'email',
            jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true),
            now(), now(), now());
    raise notice 'Akun % dibuat', v_email;
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until       = null,
           instance_id        = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
           aud                = coalesce(nullif(aud, ''), 'authenticated'),
           role               = coalesce(nullif(role, ''), 'authenticated'),
           confirmation_token = coalesce(confirmation_token, ''),
           recovery_token     = coalesce(recovery_token, ''),
           email_change_token_new = coalesce(email_change_token_new, ''),
           email_change       = coalesce(email_change, ''),
           updated_at         = now()
     where id = v_id;
    -- login email butuh baris identity; akun yang dibuat tidak lewat Auth bisa tidak punya
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
    select gen_random_uuid(), v_id, v_id::text, 'email',
           jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true), now(), now()
     where not exists (select 1 from auth.identities where user_id = v_id and provider = 'email');
    raise notice 'Kata sandi % direset', v_email;
  end if;

  -- profil + divisi PLSS (trigger membuat profil untuk akun baru; ini untuk akun lama)
  insert into public.profiles (id, full_name, division)
  values (v_id, v_name, 'PLSS')
  on conflict (id) do update set division = 'PLSS';
end $$;

select u.email, u.email_confirmed_at is not null as confirmed, p.full_name, p.division
  from auth.users u left join public.profiles p on p.id = u.id
 order by u.created_at;
