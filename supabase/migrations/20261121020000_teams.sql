-- Divisi tim untuk anggota teknikal: Mechanical atau Electrical
-- (struktur Anargya: Mechanical, Electrical, Non-technical; non-technical = PLSS di aplikasi ini).
-- Diisi PLSS saat membuat akun atau dari halaman Anggota. PLSS tidak punya divisi tim.

create type public.tech_team as enum ('MECHANICAL', 'ELECTRICAL');
alter table public.profiles add column team public.tech_team;
alter table public.profiles add constraint team_only_teknikal check (division = 'TEKNIKAL' or team is null);

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

create function public.set_team(p_user uuid, p_team public.tech_team) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_plss();
  update public.profiles set team = p_team where id = p_user and division = 'TEKNIKAL';
  if not found then
    raise exception 'Divisi tim hanya untuk anggota teknikal' using errcode = '22023';
  end if;
end $$;

revoke execute on function public.set_team(uuid, public.tech_team) from public, anon;
grant execute on function public.set_team(uuid, public.tech_team) to authenticated;
