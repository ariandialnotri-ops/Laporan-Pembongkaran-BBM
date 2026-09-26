# Bongkaran BBM & Q&Q — Monitoring App

Aplikasi pemantauan bongkaran BBM dan Quality/Quantity (Q&Q) di SPBU untuk
Kepala Shift, Pengawas, dan Area Business Head.

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

| Rute       | Isi |
|------------|-----|
| `/`        | Beranda — total bongkaran hari ini, stat tile, aksi cepat, kalender progress, status Q&Q, riwayat |
| `/input`   | Form Bongkaran / Quality / Quantity (segmented control; `?tab=quality` membuka tab itu langsung) |
| `/laporan` | Laporan & Berita Acara — ringkasan status, template, riwayat dengan filter |
| `/profil`  | Profil pengguna, statistik, menu akun |

## Perhitungan langsung di form

```
Bongkaran : selisih = realisasi − DO,  % = selisih / DO
Quality   : density terkoreksi dicek terhadap standar produk
Quantity  : meter   = meter akhir − meter awal
            % tera  = (bejana − meter) / meter
```

Toleransi (`TOLERANSI_BONGKAR_PERSEN`, `TOLERANSI_TERA_PERSEN`) dan rentang
density per produk ada di `src/data/mock.ts` sebagai **nilai contoh** —
sesuaikan dengan ketentuan yang berlaku.

## Struktur

```
src/
  components/ui/         primitif kaca: glass-card, pill, button, input, select, tabs, toast, spring-value
  components/shell/      header, dock navigasi, ambient orbs, app-shell
  components/bongkaran/  komponen domain: stat-tile, qq-pill, status-banner, photo-field
  pages/                 Dashboard, FormInput, Laporan, Profil
  lib/                   format angka Indonesia, navigasi, cn()
  data/mock.ts           data contoh — ganti saat menyambung database
```

## Backend: Supabase

Skema ada di `supabase/migrations/`:

| Objek | Isi |
|-------|-----|
| `bongkaran` | Satu baris per mobil tangki; tahap Bongkaran → Quality → Quantity mengisi kolom bertahap, lalu `qq_status` dinilai (`sesuai` / `perhatian`) |
| `laporan` | Berita acara dan laporan harian (draft / menunggu / terkirim) |
| bucket `bukti-bongkaran` | Foto segel/DO dan hasil tera (privat) |

RLS aktif. Karena aplikasi belum punya login, peran `anon` boleh membaca,
menambah, dan mengubah data (tidak boleh menghapus). **Pasang Supabase Auth
dan ganti kebijakan ke `authenticated` sebelum dipakai luas.**

Lokal: salin `.env.example` ke `.env.local` lalu isi URL dan publishable key.
Tanpa env itu, aplikasi berjalan dengan data contoh.

## Deploy: Vercel

1. Import repo `ariandialnotri-ops/Laporan-Pembongkaran-BBM` di Vercel.
2. **Root Directory**: `bongkaran-app` (framework Vite terdeteksi otomatis).
3. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. `vercel.json` sudah mengarahkan semua rute ke `index.html`.

Setiap push ke branch utama repo memicu deploy produksi; branch lain jadi preview.
