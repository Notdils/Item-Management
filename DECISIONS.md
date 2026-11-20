# DECISIONS

Keputusan manajemen data ada di README bagian "Manajemen data". Di sini keputusan lain dan alasannya.

| Keputusan | Alasan |
|---|---|
| Next.js + Supabase | Dipilih user. Deadline 2 hari, Auth + Storage + Postgres sudah tersedia, skema tetap ditulis sendiri di SQL. |
| Klien memanggil RPC langsung (bukan lewat API route) | Validasi dan izin ada di database, jadi API route hanya menambah lapisan. Server actions dipakai untuk form admin. |
| Kamera lewat `<input type=file capture=environment>` | Jalan di semua HP tanpa izin kamera terpisah, bisa juga pilih dari galeri. |
| Foto dikompres di HP (1280 px, WebP, fallback JPEG) | Foto kamera 3–8 MB jadi ±200 KB. Hemat kuota dan Storage. |
| Lokasi terakhir disimpan di `localStorage` HP | Preferensi per perangkat, tidak perlu disimpan di database. |
| GPS tidak dipakai untuk menentukan rak | Akurasi di dalam ruangan 5–20 m, tidak bisa membedakan rak. Disimpan untuk audit saja. |
| Foto wajib untuk TARUH, opsional untuk AMBIL/PAKAI | Foto di rak adalah bukti posisi. Saat mengambil, posisi barang = di tangan pelapor. |
| Barang baru dari teknikal otomatis jadi ALAT | Teknikal tidak boleh membuat barang habis pakai (stok dikelola PLSS). |
| Akun dibuat PLSS (signup publik dimatikan) | Supaya hanya anggota yang bisa melapor. Pembuatan akun memakai secret key di server. |
| Service worker tidak menyimpan halaman/data | Data posisi harus selalu terbaru dan bersifat internal. Hanya aset statis yang di-cache, plus halaman offline. |
| Tanpa batas minimum stok | Keputusan user (19 Nov). |
| UI memakai **shadcn/ui** (style new-york, Radix, lucide) | Diminta user (19 Nov). Komponen dipasang lewat `npx shadcn@latest add` di laptop (registry tidak bisa diakses dari sandbox Claude). Gaya Figma diterapkan dengan mengubah varian `cva`, bukan menimpa `className`: lihat `scripts/customize-ui.py` (tombol/input 52 px, radius 10, tabel header mono, badge status `ok/warn/muted`, toggle `segmented`, alert `success/warning`). |
| Pilihan 2 opsi memakai `ToggleGroup` | Aturan skill shadcn. Untuk form server (divisi anggota) nilainya disalin ke input tersembunyi (`DivisionToggle`). |
| `loading.tsx` hanya di Lapor, Cari, Dipegang, Stok, Detail | `loading.tsx` di level `(app)` membuat redirect server action kehilangan query `?pesan=` (pesan sukses tidak muncul). Halaman Akun/admin memakai redirect itu, jadi tanpa loading. |
| Tampilan error (`error.tsx`, `global-error.tsx`) | Sebelumnya error di klien membuat layar gelap kosong. Sekarang tampil pesan + kode digest. |
| Responsif: mobile (tab bar), tablet `md` 768 (top bar + tab bar, grid 2 kolom), desktop `lg` 1024 (sidebar, tabel) | Sesuai Figma section per halaman (Desktop 1280 / Tablet 800 / Mobile 390). |
| GRANT eksplisit per tabel/view ke `authenticated`, tidak ada yang ke `anon` | Supabase (changelog #45329) mematikan *Automatically expose new tables* untuk project baru sejak 30 Mei 2026 dan untuk semua project sejak 30 Okt 2026. Izin kini ditulis di migrasi: SELECT untuk semua tabel/view aplikasi, INSERT/UPDATE `locations` (dibatasi RLS ke PLSS), UPDATE kolom `full_name` saja di `profiles`. Penulisan lain tetap lewat RPC. Tes memakai stub tanpa default privileges supaya meniru produksi. |
| Batalkan laporan = baris baru di tabel `voids`, bukan hapus/ubah | Riwayat tetap append-only (bisa diaudit). View posisi dan stok mengabaikan laporan yang dibatalkan. Hanya pelapor sendiri, maks 5 menit (tombol tampil 30 detik), laporan alat hanya jika masih yang terbaru, dan mutasi stok tidak boleh membuat stok minus. Semua dicek di RPC `void_entry` dengan kunci baris barang. |
| Beranda PLSS = Ringkasan (lewat 12 jam, sedang dibawa, stok kosong) | Hasil critique + uji persona: PLSS mendarat di kamera padahal tugasnya mengawasi. Lapor tetap di `/lapor`. Grup "Kelola" di sidebar memisahkan alat kerja admin dari pengaturan akun (Jakob's Law). Badge jumlah lewat 12 jam di navigasi. |
| Tombol Taruh/Ambil/Pakai langsung membuka form terisi (`/lapor?item=&aksi=`) | Barang dan aksi sudah pasti, jadi ditampilkan sebagai ringkasan; rak terisi dari rak asal barang (Taruh) atau rak dengan stok terbanyak (Pakai). Pengguna tinggal foto lalu kirim. |
| Umpan balik setiap aksi: tombol submit `useFormStatus` + spinner, link `useLinkStatus`, pesan hasil difokus | Nielsen #1 dan Shneiderman (informative feedback, closure): mencegah klik berulang saat menunggu. |

