# CONTEXT: Bengkel Anargya

Dokumen serah terima untuk chat Claude berikutnya. Baca: `D:\CONTEXT.md` (peta semua project) → file ini → `DECISIONS.md` → `TODO.md` → `README.md`.

## Ringkasan
- **Apa:** PWA manajemen barang bengkel untuk anak **teknikal** dan **PLSS** Anargya ITS EV Team. Masalah: teknikal lupa menaruh barang di mana, PLSS repot mencari.
- **Tujuan:** penilaian backend internship (mini project GIIAS tidak punya backend). Yang dinilai: **cara mengelola data**.
- **Deadline:** Sabtu 21 Nov 2026, 11.00 WIB.
- **Jenis project:** project tim (boleh menyebut ITS). Warna hitam `#0c1211` + hijau `#29D970`, Inter + Roboto Mono. Bahasa UI: Indonesia.

## Lokasi
| | |
|---|---|
| Kode | `D:\bengkel-anargya` |
| GitHub | `Notdils/Item-Management` (git dipegang user) |
| Supabase | project `hbfayzjeygyybaksvifo` |
| Figma | page "Bengkel Anargya: Mobile" (node `306:24`) di file `dAypXrqoA5G3zaGGk71ldJ` |
| Skill | `modern-web-guidance` terpasang di `.claude/skills/` (dipakai untuk UI) |

## Keputusan dari user
- Website + PWA. Alur: foto → nama → waktu & lokasi otomatis → submit. Login wajib supaya ketahuan siapa yang lapor.
- Fitur v1: lokasi barang, pinjam/kembali (Taruh/Ambil), riwayat & pengingat. **Tanpa** QR code.
- PLSS = admin data. Teknikal = pelapor.
- Barang habis pakai **ikut** dicatat, dengan jumlah stok. **Tanpa** batas minimum stok.
- Lokasi: rak terakhir yang dipilih + ganti 1 tap. GPS disimpan sebagai data tambahan.
- Batas "dipegang terlalu lama": **12 jam**.

## Status
Lihat TODO.md.

## Aturan kerja
Sama dengan `D:\CONTEXT.md` §5–6: Bahasa Indonesia, tanpa em dash, surgical, Figma dulu, tidak commit/push, tidak menambah co-author, tidak menghapus file, jangan tulis secret key.
