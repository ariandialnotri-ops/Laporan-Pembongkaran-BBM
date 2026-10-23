<p align="center">
  <img src="bongkaran-app/public/floq-logo.webp" alt="FLOQ" height="96">
</p>

# FLOQ: Fuel Logistics Operations & Quality

Aplikasi web (PWA) operasional SPBU: evidence bongkaran BBM, Quality & Quantity (Q&Q), plan
pengiriman dan LO tracking, kualitas harian, stok & totalizer, absensi, perawatan dan
housekeeping, HSSE (APAR, insiden, stop penyaluran), petty cash, closing shift, serta laporan
SO bulanan. Dipakai Kepala Shift, Pengawas, Area Business Head (ABH), Security, dan Cleaning
Service, dengan menu dan hak tulis mengikuti peran.

## Isi repo

| Folder | Isi |
|---|---|
| [`bongkaran-app/`](bongkaran-app/) | Aplikasi FLOQ (React 19 + Vite + TypeScript + Tailwind v4) |
| [`bongkaran-app/supabase/`](bongkaran-app/supabase/) | Migration database (Postgres + RLS) dan edge function |
| [`bongkaran-app/DESIGN.md`](bongkaran-app/DESIGN.md) | Spesifikasi tampilan: token, komponen, setiap layar, aturan wajib |
| [`pantas/`](pantas/) | Arsip identitas PANTAS (konsep terpisah, tidak dipakai aplikasi FLOQ) |

## Menjalankan

```bash
cd bongkaran-app
npm install
cp .env.example .env.local   # opsional: isi URL & publishable key Supabase
npm run dev                  # http://localhost:5173
npm run build                # type-check + build produksi
npm run lint
```

Tanpa `.env.local` aplikasi berjalan di **mode lokal**: data disimpan di IndexedDB perangkat,
cocok untuk demo dan pengembangan. Dengan env terisi, aplikasi terhubung ke Supabase dan wajib login.

| Variabel | Isi |
|---|---|
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Jangan pernah memakai service role key di frontend |

## Database

Skema ada di [`bongkaran-app/supabase/migrations/`](bongkaran-app/supabase/migrations/) dan
dijalankan berurutan menurut nama berkas (`supabase db push`, atau SQL Editor). Semua tabel
memakai RLS per SPBU dan per peran. Aturan penting seperti penguncian Berita Acara yang sudah
selesai, token QR absensi, dan validasi absen ditegakkan di database, bukan hanya di aplikasi.
Rincian tiap migration ada di bagian *Backend: Supabase* pada
[`bongkaran-app/README.md`](bongkaran-app/README.md).

## Deploy

Vercel dengan **Root Directory** `bongkaran-app`, serta dua variabel env di atas untuk
Production dan Preview. `bongkaran-app/vercel.json` mengatur rewrite SPA dan header keamanan
(CSP, HSTS, X-Frame-Options, Permissions-Policy).

## Dokumentasi lanjut

- [`bongkaran-app/README.md`](bongkaran-app/README.md): fitur per layar, alur SOP bongkaran, perhitungan, laporan, multi SPBU, backend
- [`bongkaran-app/DESIGN.md`](bongkaran-app/DESIGN.md): sistem desain dan aturan tampilan
