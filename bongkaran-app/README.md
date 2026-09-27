# FLOQ — Fuel Logistic Quality & Quantity

Aplikasi evidence dan pemantauan bongkaran BBM serta Quality/Quantity (Q&Q) di
SPBU untuk Kepala Shift, Pengawas, dan Area Business Head.

Logo dan ikon ada di `public/` (`floq-login.webp` untuk halaman login,
`floq-icon.webp` untuk header, `favicon.png`, `apple-touch-icon.png`, dan
`floq-icon-256.png` untuk `manifest.webmanifest`).

UI memakai design system **AeroShift** yang sama dengan aplikasi
**Tepat Setoran SPBU**: kartu kaca (glassmorphism) bergaya iOS di atas kanvas
gradasi dingin, dock navigasi melayang, Plus Jakarta Sans untuk antarmuka dan
JetBrains Mono untuk semua angka. Brief lengkapnya ada di
[`design-system/aeroshift/DESIGN.md`](design-system/aeroshift/DESIGN.md).

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4 — token AeroShift (peran warna Material-3, resep kaca
  `glass-1/2/3`, `inset-field`, `rim-light`, `tabular`, motion) di `src/index.css`
- Radix UI (Tabs, Select, Label) + lucide-react
- Font lokal via `@fontsource-variable` (tanpa CDN)

## Menjalankan

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + build produksi
npm run lint
```

## Layar

| Rute         | Isi |
|--------------|-----|
| `/`          | Beranda — total bongkaran hari ini, stat tile, aksi cepat, kalender progress, status Q&Q, riwayat |
| `/input`     | Mulai bongkaran baru dan daftar bongkaran berjalan |
| `/input/:id` | Form bongkaran 14 langkah SOP dalam tiga fase (Bongkaran → Quality → Quantity) + tab Finish |
| `/plan`      | Plan kirim harian: SO, produk, Sold To, dan LO (jumlah DO per LO) |
| `/kalkulator`| Density @15°C (ASTM 53) dan volume tangki pendam dari tinggi deepstick/ATG |
| `/laporan`   | Berita Acara — ringkasan status dan riwayat dengan filter |
| `/profil`    | Profil pengguna, statistik, menu Plan/Kalkulator/Pengaturan/Anggota |
| `/pengaturan`| Identitas SPBU, nama default petugas/pengawas, aturan toleransi, data acuan |
| `/anggota`   | Kelola anggota dan peran (khusus pengawas, mode Supabase) |

## Alur SOP bongkaran

Setiap langkah wajib foto evidence dan data isian; langkah berikutnya terkunci
sampai langkah sebelumnya lengkap. Semua isian tersimpan otomatis.

| Fase | Langkah |
|------|---------|
| Bongkaran | 1 MT tiba · 2 Dokumen LO (pilih SO & LO dari plan) · 3 Buku tera · 4 ATG sebelum · 5 Safety · 6 Segel · 7 Deepstick tangki sebelum · 8 Water content & draining · 9 Deepstick kompartemen MT |
| Quality   | 10 Sampel atas/bawah · 11 Density (dihentikan bila selisih D15 > toleransi) |
| Quantity  | 12 Selang & fillport · 13 ATG setelah (min. 10 menit setelah selesai) · 14 Deepstick tangki setelah |

Selisih deepstick MT terhadap tera > 10 mm butuh izin penanggung jawab.
Finish menghasilkan **Berita Acara Pembongkaran (Quality & Quantity)** sebagai
PDF atau JPG (lengkap dengan foto), dan teks laporan untuk grup WhatsApp SPBU.
Density di luar toleransi menutup bongkaran sebagai BA anomali.

## Perhitungan

```
Density @15°C : tabel ASTM-IP 53 (interpolasi bilinear), cadangan rumus ASTM D1250 Tabel 53B
Volume tangki : interpolasi linear tabel kalibrasi per tangki (src/data/tankTables.json)
Gain / loss   : real stok ATG − (stok awal ATG + volume DO)
Deepstick     : volume setelah − volume sebelum, dibanding volume DO
```

Toleransi default (density 0,003; tera 10 mm; ATG 10 menit; volume per DO
8.000 L) bisa diubah di Pengaturan. Data acuan tabel ada di `src/data/`
(`table53.json`, `tankTables.json`).

## Struktur

```
src/
  components/ui/         primitif kaca: glass-card, pill, button, input, select, tabs, toast, spring-value
  components/shell/      header, dock navigasi, ambient orbs, app-shell, app-provider (state global)
  components/bongkaran/  langkah SOP, slot foto, panel finish, layout cetak BA, stat-tile, qq-pill
  pages/                 Dashboard, FormInput, FormBongkar, Plan, Kalkulator, Laporan, Profil, Pengaturan, Anggota, Login
  lib/sop.ts             definisi 14 langkah, validasi & hitungan bongkaran
  lib/density.ts         density @15°C (ASTM 53)
  lib/tank.ts            volume tangki dari ketinggian
  lib/pdf.ts, jpg.ts, wa.ts   keluaran Berita Acara
  lib/backend/           Supabase atau IndexedDB lokal (dipilih otomatis)
  data/                  tabel ASTM 53 dan tabel kalibrasi tangki
```

## Backend: Supabase

Tanpa env Supabase aplikasi berjalan di **mode lokal** (data disimpan di
IndexedDB perangkat). Dengan env terisi, data tersinkron dan wajib login.

Skema yang dipakai aplikasi ada di
`supabase/migrations/20260926120000_bbm_init.sql` dan
`20260926120500_bbm_private_helpers.sql`:

| Objek | Isi |
|-------|-----|
| `bbm_members` | Anggota dan peran (`pengawas` / `petugas`) |
| `bbm_settings` | Pengaturan SPBU |
| `bbm_plans` | Plan kirim (SO & LO) |
| `bbm_reports` | Satu baris per bongkaran; isi langkah SOP di kolom JSON |
| bucket `bbm-evidence` | Foto evidence (privat, diakses lewat signed URL) |

RLS aktif: hanya anggota yang bisa membaca/menulis; petugas hanya bisa
menghapus draft miliknya, pengawas mengelola semuanya. Pengguna pertama yang
login otomatis menjadi pengawas, lalu menambah anggota lain di `/anggota`
(akun dibuat dulu di Supabase → Authentication).

Tabel lama `bongkaran`, `laporan`, dan bucket `bukti-bongkaran` (migrasi
`2026092600*`) tidak lagi dipakai aplikasi.

Lokal: salin `.env.example` ke `.env.local` lalu isi URL dan publishable key.

## Deploy: Vercel

1. Import repo `ariandialnotri-ops/Laporan-Pembongkaran-BBM` di Vercel.
2. **Root Directory**: `bongkaran-app` (framework Vite terdeteksi otomatis).
3. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. `vercel.json` sudah mengarahkan semua rute ke `index.html`.

Setiap push ke branch utama repo memicu deploy produksi; branch lain jadi preview.
