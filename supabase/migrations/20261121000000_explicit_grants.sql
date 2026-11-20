-- Izin eksplisit untuk role `authenticated`.
-- Project Supabase baru tidak lagi memberi izin otomatis ke anon/authenticated untuk tabel baru
-- di schema public. Tanpa ini, query apa pun dari aplikasi gagal dengan
-- "permission denied for table profiles" (gejala: halaman blank / redirect loop / "Aplikasi gagal dimuat").
-- RLS tetap menentukan baris mana yang boleh dibaca/diubah. Aman dijalankan berkali-kali.

grant usage on schema public to authenticated;

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

-- Tulis langsung hanya untuk: lokasi (PLSS, dijaga RLS) dan nama tampilan sendiri.
-- Riwayat (reports, stock_moves) dan barang tetap hanya lewat RPC.
grant insert, update on public.locations to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Tamu tetap tidak boleh apa-apa
revoke all on all tables in schema public from anon;
