# Bengkel Anargya

Sistem manajemen barang bengkel Anargya ITS EV Team. Anggota teknikal sering lupa menaruh alat di mana, dan PLSS yang repot mencarinya. Di aplikasi ini setiap alat yang ditaruh wajib difoto di raknya, setiap alat yang diambil tercatat atas nama yang membawa, dan stok bahan habis pakai dihitung dari riwayat mutasinya.

Dibuat untuk penilaian **backend** internship Web Development Anargya ITS EV Team.

- Aplikasi: https://itemmanagement.vercel.app
- Stack backend: Supabase (Postgres 15+, Auth, Storage, RLS), dipanggil dari Next.js 15 (server components + server actions)

### Akun penilaian

| Peran | Email | Kata sandi |
|---|---|---|
| PLSS (admin data) | `plss@example.com` | `plssadmin` |
| Teknikal, Mechanical | `mechanical@example.com` | `teknikal` |
| Teknikal, Electrical | `electrical@example.com` | `teknikal` |

## Model data

```mermaid
erDiagram
  profiles ||--o{ reports : melapor
  profiles ||--o{ stock_moves : mencatat
  profiles ||--o{ voids : membatalkan
  items ||--o{ reports : "posisi (ALAT)"
  items ||--o{ stock_moves : "stok (HABIS_PAKAI)"
  locations ||--o{ reports : "TARUH di"
  locations ||--o{ stock_moves : "stok di"
  items ||--o{ item_merges : digabung
  reports |o--o| voids : dibatalkan
  stock_moves |o--o| voids : dibatalkan

  profiles { uuid id PK "= auth.users.id" text full_name "division TEKNIKAL|PLSS" "team MECHANICAL|ELECTRICAL|null" }
  locations { bigint id PK text code UK text name timestamptz archived_at }
  items { bigint id PK text name text name_key "generated, unik di barang aktif" item_kind kind text unit timestamptz archived_at }
  reports { bigint id PK bigint item_id FK report_kind kind "TARUH|AMBIL" bigint location_id FK uuid user_id FK text photo_path timestamptz taken_at timestamptz created_at float lat float lng }
  stock_moves { bigint id PK bigint item_id FK bigint location_id FK stock_kind kind "MASUK|PAKAI|OPNAME" int qty_delta uuid user_id FK timestamptz created_at }
  item_merges { bigint id PK bigint from_item_id FK bigint into_item_id FK int moved_reports int moved_moves }
  voids { bigint id PK bigint report_id "FK, unik" bigint move_id "FK, unik" uuid voided_by FK timestamptz voided_at }
```

View (semua `security_invoker`, jadi RLS tetap berlaku):

| View | Isi |
|---|---|
| `item_positions` | Posisi terakhir tiap alat = laporan terbaru yang tidak dibatalkan (`DISTINCT ON` + index `(item_id, created_at desc, id desc)`) |
| `held_items` | Alat yang sedang dibawa, dengan `overdue` = lebih dari 12 jam |
| `stock_levels` | Sisa stok per barang per lokasi = `SUM(qty_delta)` dari mutasi yang tidak dibatalkan |
| `item_overview` | Ringkasan untuk pencarian: posisi alat atau total stok |

## Keputusan manajemen data

1. **Riwayat adalah sumber kebenaran.** Tidak ada kolom `posisi_sekarang` atau `stok` yang disimpan. Posisi dan stok selalu dihitung dari riwayat lewat view, jadi angkanya tidak bisa melenceng dari riwayatnya.
2. **Riwayat append-only.** Trigger `tg_history_append_only` menolak `UPDATE` dan `DELETE` pada `reports`, `stock_moves`, dan `voids`. Satu-satunya pengecualian adalah pemindahan `item_id` saat PLSS menggabungkan barang duplikat, dan setiap penggabungan dicatat di `item_merges`. Barang dan lokasi tidak dihapus, hanya diarsip (`archived_at`).
3. **Koreksi tanpa menghapus.** Laporan yang salah dibatalkan dengan menambah baris di `voids`, bukan menghapus. View posisi dan stok mengabaikan laporan yang dibatalkan, sedangkan riwayat dan ekspor CSV tetap menampilkannya dengan tanda "Batal". Aturannya dicek di RPC `void_entry` (lihat tabel di bawah).
4. **Tulis hanya lewat RPC.** Klien tidak punya izin `INSERT/UPDATE/DELETE` ke tabel riwayat. Semua penulisan lewat fungsi `SECURITY DEFINER` dengan `search_path = ''`, yang:
   - memvalidasi waktu foto (tidak di masa depan, tidak lebih dari 7 hari),
   - memastikan foto sudah ada di Storage dan berada di folder milik pelapor,
   - menormalkan nama barang (`"Kunci  Ring 10"` = `"kunci ring 10"`) lewat kolom generated `name_key` dan unique index parsial,
   - **mengunci baris barang** (`SELECT ... FOR UPDATE`), sehingga dua laporan bersamaan untuk barang yang sama diproses berurutan.
5. **Constraint di database, bukan hanya di UI.**
   - `TARUH` wajib punya lokasi dan foto; `AMBIL` tidak boleh punya lokasi (`CHECK`).
   - `MASUK` harus positif, `PAKAI` negatif (`CHECK delta_sign`).
   - Laporan posisi hanya untuk `ALAT`, mutasi stok hanya untuk `HABIS_PAKAI` (trigger `tg_check_item_kind`).
   - Stok tidak boleh minus. Dicek di dalam transaksi yang sudah mengunci barang, dan diuji dengan dua sesi paralel.
   - Kode lokasi berformat `RAK-A` (`CHECK` regex) dan unik.
   - Satu pembatalan per laporan (`UNIQUE` di `voids`), tepat satu sasaran (`CHECK num_nonnulls(report_id, move_id) = 1`).
   - Hanya anggota teknikal yang punya divisi tim (`CHECK team_only_teknikal`); dijadikan PLSS otomatis mengosongkan tim.
6. **Dua jam.** `taken_at` = jam di HP (kapan foto diambil), `created_at` = jam server. Urutan memakai jam server karena jam HP bisa salah. Keduanya disimpan.
7. **Hitung ulang stok (stok opname) tidak menimpa angka.** PLSS memasukkan hasil hitung fisik, lalu selisihnya dicatat sebagai mutasi `OPNAME`. Riwayat lama tetap utuh.
8. **Divisi dan tim.** `division` (TEKNIKAL atau PLSS) menentukan hak akses. `team` (Mechanical atau Electrical, mengikuti struktur tim Anargya) hanya untuk pengelompokan anggota teknikal. Divisi diambil dari `app_metadata` (hanya bisa diisi admin), bukan `user_metadata` yang bisa diisi pengguna.
9. **Ekspor CSV** aman dari formula injection: sel yang diawali `= + - @` diberi awalan `'`.

## Referensi RPC

Semua fungsi butuh login (`28000 Harus login` kalau tidak). Error dikirim sebagai kode SQLSTATE dengan pesan berbahasa Indonesia.

| Fungsi | Siapa | Aturan yang dicek | Error |
|---|---|---|---|
| `report_item(nama, kind, lokasi, foto, taken_at, lat, lng, akurasi, catatan)` → id laporan | Semua anggota | Waktu foto wajar; foto ada dan milik pelapor; lokasi aktif; nama dinormalkan, barang baru otomatis jadi ALAT; barang dikunci | `22007` waktu, `42501`/`23503` foto, `23503` lokasi, `23514` jenis barang salah, `22023` nama terlalu pendek |
| `move_stock(nama, kind, lokasi, qty, satuan, foto, taken_at, catatan)` → `(move_id, qty_after)` | PAKAI: semua. MASUK dan OPNAME: PLSS | Jumlah valid; barang baru hanya lewat MASUK; OPNAME menghitung selisih dari sisa tercatat; sisa tidak boleh minus | `42501` bukan PLSS, `22023` jumlah, `P0002` barang belum terdaftar, `23514` stok tidak cukup |
| `void_entry(report_id \| move_id)` | Pelapor sendiri | Maks 5 menit setelah kirim; laporan alat hanya kalau masih yang terbaru; pembatalan mutasi tidak boleh membuat stok minus; belum pernah dibatalkan | `42501` bukan milik sendiri, `22023` lewat 5 menit / sudah ada laporan lebih baru, `23514` stok jadi minus, `23505` sudah dibatalkan |
| `merge_items(dari, ke)` | PLSS | Dua barang berbeda, aktif, dan sejenis; riwayat dipindah, sumber diarsip, dicatat di `item_merges` | `22023` barang sama, `P0002` tidak ditemukan, `23514` jenis berbeda |
| `archive_item(id)` | PLSS | Barang ada | `P0002` |
| `rename_item(id, nama)` | PLSS | Nama baru tidak bentrok dengan barang aktif lain | `P0002`, `23505` |
| `set_division(user, division)` | PLSS | Tidak bisa menurunkan diri sendiri; jadi PLSS mengosongkan tim | `22023` |
| `set_team(user, team)` | PLSS | Hanya untuk anggota teknikal | `22023` |

## Hak akses

| Peran | Baca | Tulis |
|---|---|---|
| Tamu (`anon`) | Tidak ada | Tidak ada |
| Teknikal | Semua tabel dan view (tujuannya transparansi posisi barang), kecuali `item_merges` | Lapor Taruh/Ambil, Pakai stok, batalkan laporan sendiri, ganti nama tampilan sendiri (`UPDATE (full_name)` saja) |
| PLSS | Semua | Semua yang teknikal bisa, ditambah stok masuk, hitung ulang stok, gabung/arsip/ganti nama barang, kelola lokasi (RLS), divisi dan tim anggota, ekspor CSV. Pembuatan akun lewat Auth Admin API dengan secret key di server |

- **Grant eksplisit.** Sejak 2026, project Supabase baru tidak lagi memberi izin otomatis ke tabel di schema `public` (changelog #45329). Karena itu semua izin ditulis di migrasi: `SELECT` per tabel dan view untuk `authenticated`, tidak ada yang untuk `anon`, dan `EXECUTE` hanya untuk RPC publik.
- **Foto.** Bucket privat `photos`, unggah hanya ke `photos/<uid>/`, tidak bisa diganti atau dihapus. Ditampilkan lewat signed URL 1 jam.

## Tes

`supabase/tests/run_tests.sh` menjalankan semua migrasi di Postgres biasa, memakai tiruan skema `auth` dan `storage` **tanpa izin default** (sama seperti project Supabase baru). Ada 40 pengecekan:

- izin per peran,
- constraint,
- normalisasi nama,
- append-only,
- hitung ulang stok,
- merge,
- pembatalan (posisi kembali, laporan orang lain ditolak, laporan lama ditolak, stok tidak boleh minus),
- divisi tim,
- **konkurensi**: dua sesi memakai 100 dari sisa 125 bersamaan, tepat satu yang berhasil dan sisanya 25.

```bash
PGHOST=<host> PGPORT=<port> bash supabase/tests/run_tests.sh
```

## Menjalankan

### 1. Supabase

**Project baru (kosong):** jalankan `supabase/master.sql` di SQL Editor (Ctrl+A, lalu Run). Isinya keempat migrasi dan data awal (rak RAK-A sampai RAK-C dan katalog barang). Setiap query diberi komentar jenis dan nama objeknya, plus baris `-- Catatan:` untuk penjelasan tambahan.

**Project yang sudah berjalan:** jalankan migrasi yang belum dijalankan, berurutan:
1. `supabase/migrations/20261119000000_init.sql`: skema inti.
2. `20261121000000_explicit_grants.sql`: grant eksplisit. Tanpa ini login gagal dengan `permission denied for table profiles`.
3. `20261121010000_undo.sql`: pembatalan lewat `voids`.
4. `20261121020000_teams.sql`: divisi tim Mechanical/Electrical.

Lalu:
- **Authentication → Sign In / Providers → Email**: matikan *Allow new users to sign up* (akun dibuat oleh PLSS).
- `supabase/seed_admin.sql`: buat atau reset akun PLSS (isi kata sandi dulu).
- `supabase/seed_members.sql`: akun teknikal Mechanical dan Electrical (isi kata sandi dulu).
- `supabase/seed.sql`: rak dan katalog barang, kalau belum lewat `master.sql`. Stok diisi PLSS lewat Hitung ulang stok setelah hitung fisik.

### 2. Lokal
```bash
cp .env.example .env.local   # isi URL, publishable key, dan secret key
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy (Vercel)
Isi env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`. Secret key hanya di server (Vercel dan `.env.local`), jangan di-commit.

## Struktur backend

```
supabase/
  master.sql                          semua migrasi + data awal dalam satu file (project baru)
  migrations/20261119000000_init.sql  skema, constraint, trigger, RPC, view, RLS, storage
  migrations/…_explicit_grants.sql    GRANT eksplisit untuk Data API
  migrations/…_undo.sql               tabel voids + RPC void_entry, view mengabaikan laporan batal
  migrations/…_teams.sql              divisi tim teknikal + RPC set_team
  seed.sql                            rak + katalog barang awal
  seed_admin.sql                      buat / reset akun PLSS
  seed_members.sql                    akun teknikal per divisi tim
  bootstrap.sql                       buat profil untuk akun lama + jadikan PLSS
  tests/                              tes skema, pembatalan, tim, konkurensi
```

### Frontend (ringkas)

Next.js 15 App Router, Tailwind v4, shadcn/ui, PWA. Bagian yang memanggil backend:
- `src/lib/supabase/`: klien server, browser, dan admin (secret key, hanya di server).
- `src/app/(app)/akun/actions.ts`: server actions PLSS (lokasi, barang, hitung ulang stok, anggota, divisi tim).
- `src/app/(app)/(lapor)/Reporter.tsx`: unggah foto ke Storage, lalu panggil `report_item`, `move_stock`, atau `void_entry`.
