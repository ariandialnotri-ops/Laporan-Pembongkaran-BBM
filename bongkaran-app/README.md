# FLOQ (Fuel Logistic Quality & Quantity)

Aplikasi evidence dan pemantauan bongkaran BBM serta Quality/Quantity (Q&Q) di
SPBU untuk Kepala Shift, Pengawas, dan Area Business Head.

Logo dan ikon ada di `public/` (`floq-login.webp` untuk halaman login,
`floq-icon.webp` untuk header, `favicon.png`, `apple-touch-icon.png`, dan
`floq-icon-256.png` untuk `manifest.webmanifest`).

UI memakai design system **AeroShift** yang sama dengan aplikasi
**Tepat Setoran SPBU**: kartu kaca (glassmorphism) bergaya iOS di atas kanvas
gradasi dingin, dock navigasi melayang, font Inter (angka memakai `tabular-nums`)
mengikuti referensi stitch "Sistem Serba Bisa". Brief lengkapnya ada di
[`design-system/aeroshift/DESIGN.md`](design-system/aeroshift/DESIGN.md).

Spesifikasi tampilan FLOQ yang lengkap (token, komponen, setiap layar, cara mengganti desain, dan prompt untuk tool desain AI) ada di [`DESIGN.md`](DESIGN.md).

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4: token AeroShift (peran warna Material-3, resep kaca
  `glass-1/2/3`, `inset-field`, `rim-light`, `tabular`, motion) di `src/index.css`
- Radix UI (Tabs, Select, Label, Dialog untuk bottom sheet) + lucide-react
- JSZip (isi template Excel), jsPDF, font Carlito/Arimo (metrik sama dengan Calibri/Arial) untuk PDF/JPG laporan
- Font lokal via `@fontsource-variable` (tanpa CDN)

## Menjalankan

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + build produksi
npm run lint
```

## Layar

Dock bawah berisi 4 menu. Dashboard hanya menampilkan data, semua pengisian
ada di Input, semua riwayat dan unduhan ada di Laporan.

| Menu | Rute | Isi |
|------|------|-----|
| Dashboard | `/` | Kartu operasional (tanggal & shift), Status Bongkaran Pekan Ini (7 kotak hari dengan ikon status & titik plan kirim; ketuk tanggal untuk plan, penerimaan, kualitas, kuantitas), Bongkaran Hari Ini per produk (dropdown: MT, diterima, transport loss, discharge loss L & %), SLA rata-rata, Rencana vs Realisasi, Kualitas Harian, Kaleng Sample (D15 sample 2 jam dari 3 bongkaran terakhir), LO Tracking |
| Input | `/input` | Bar wajib Stok Awal Shift + kartu: |
| | `/stok` | Stok awal tiap produk (wajib tiap awal shift) dan pengeluaran dispenser |
| | `/input/bongkar` | Input Bongkaran: mulai bongkaran baru (terkunci sampai stok awal diisi) dan bongkaran berjalan |
| | `/input/:id` | Form bongkaran 14 langkah SOP + tab Finish. Kompartemen: tinggi tera, tinggi T2, kapasitas, kepekaan (mm/liter) dari buku tera MT. Tanda tangan lewat pop up berkotak panduan. Unduhan: Excel, PDF BA saja (cepat), PDF + foto, JPG. Konfirmasi saat keluar dari form yang belum selesai; bongkaran selesai tidak dapat dihapus |
| | `/plan` | Plan Pengiriman: permintaan MS2 (bottom sheet) dengan shift per produk; tabel LO (tgl kirim, SO, LO, produk, volume, shift, supply point, MS2, status), ketuk baris untuk ubah LO, ubah SO & MS2, atau tambah LO. Pengingat harian pukul 06:00 bila plan besok belum dibuat |
| | `/kualitas` | Kualitas Harian: density & suhu per produk, tera bejana 20 L per nozzle; tiap baris disimpan sendiri, foto struk & pengembalian minyak wajib di akhir uji |
| | `/sample` | Sample BBM 2 Jam: uji density tangki pendam minimal 2 jam setelah bongkar selesai, dibanding D15 depot |
| Laporan | `/laporan` | Kartu laporan: |
| | `/laporan/persediaan` | Catatan Persediaan BBM, unduh Excel/PDF sesuai template |
| | `/laporan/ba` | Berita Acara: status tanda tangan, buka untuk TTD pengawas/ABH atau unduh |
| | `/laporan/bongkaran` | Riwayat Pembongkaran MT: produk, tanggal penerimaan, SO, LO, nopol & supir, volume, transport loss, discharge loss (L, %), SLA (request MS2 / gate out sampai selesai bongkar), keterangan, progress |
| | `/laporan/lo` | Riwayat Tracking LO: tanggal permintaan kirim, SO, LO, produk, volume, supply point, nopol MT, status; ketuk baris untuk ubah lewat pop up (LO Closed terkunci) |
| | `/laporan/kualitas` | Riwayat Kualitas Harian: uji harian dan sample 2 jam |
| | `/laporan/tera` | Riwayat Tera: bejana 20 L per nozzle, batas -60 ml |
| Profil | `/profil` | Akun, statistik, Kalkulator, Pengaturan, Anggota |
| | `/kalkulator` | Density @15°C (ASTM 53) dan volume tangki pendam |
| | `/pengaturan` | Identitas SPBU, nama default, perusahaan pengangkut, nozzle dispenser, toleransi, data acuan |
| | `/anggota` | Kelola anggota dan peran (khusus pengawas, mode Supabase) |

Sample BBM 2 Jam disimpan di data bongkaran (`report.data.sample2Jam`, ringkasan
`summary.sample2Jam`), tanpa tabel baru.

## Alur SOP bongkaran

Setiap langkah wajib foto evidence dan data isian; langkah berikutnya terkunci
sampai langkah sebelumnya lengkap. Semua isian tersimpan otomatis.

| Fase | Langkah |
|------|---------|
| Bongkaran | 1 MT tiba + nopol, 2 Dokumen LO (pilih SO & LO dari plan, Ship To, volume DO liter, shift bongkar otomatis), 3 Buku tera + kapasitas kompartemen, 4 ATG sebelum + totalisator awal nozzle, 5 Safety, 6 Segel atas & bawah (nomor segel dicocokkan dengan data LO), 7 Deepstick tangki sebelum, 8 Water content & draining, 9 Deepstick kompartemen MT |
| Quality   | 10 Sampel atas/bawah, 11 Density (dihentikan bila selisih D15 > toleransi) |
| Quantity  | 12 Hose & fillport, 13 ATG setelah (min. 10 menit setelah selesai) + totalisator akhir, 14 Deepstick tangki setelah + tanda tangan digital |

Shift bongkar: Shift 1 06:00-13:59, Shift 2 14:00-21:59, Shift 3 22:00-05:59
(jam 00:00-05:59 masuk tanggal shift sebelumnya).

Tanda tangan: penerima, security, dan supir tangki wajib sebelum selesai;
pengawas dan ABH bisa menandatangani nanti dari tab Finish.

Selisih deepstick MT terhadap tera > 10 mm butuh izin penanggung jawab.
Finish menghasilkan **Berita Acara Pembongkaran** sebagai Excel, PDF, atau JPG
(PDF dilampiri foto evidence), dan teks laporan untuk grup WhatsApp SPBU.

## Laporan sesuai template Excel

Template asli ada di `public/templates/floq-template.xlsx` (sheet
"BERITA ACARA PEMBONGKARAN" dan "Catatan Persediaan BBM,"). Ekspor Excel
mengisi sel template itu langsung (font, logo, border, rumus tetap). PDF/JPG
digambar dari tata letak template yang sama (`src/data/report-templates.json`).
Bila template berubah, jalankan ulang:

```bash
python3 scripts/build-report-templates.py path/ke/template.xlsx
```

Catatan Persediaan BBM: satu baris per shift per produk, 15 baris per lembar.
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
  components/shell/      header (tombol kembali), dock navigasi, ambient orbs, app-shell, app-provider (state global)
  components/bongkaran/  langkah SOP, slot foto, panel finish, tanda tangan, filter tanggal, stok-gate, stat-tile, qq-pill
  pages/                 Dashboard, InputMenu, FormInput, FormBongkar, Plan, QqHarian, Sample2Jam, StokShift,
                         LaporanMenu, Persediaan, BeritaAcara, RiwayatBongkaran, RiwayatLo, RiwayatKualitas, RiwayatTera,
                         Kalkulator, Profil, Pengaturan, Anggota, Login
  lib/sop.ts             definisi 14 langkah, validasi & hitungan bongkaran
  lib/plan.ts            status SO/LO
  lib/shift.ts           pembagian shift
  lib/daily.ts           stok shift & Q&Q harian
  lib/report/            ekspor BA & Catatan Persediaan (xlsx dari template, PDF/JPG via canvas)
  lib/density.ts         density @15°C (ASTM 53)
  lib/tank.ts            volume tangki dari ketinggian
  lib/wa.ts              teks laporan WhatsApp
  lib/backend/           Supabase atau IndexedDB lokal (dipilih otomatis)
  data/                  tabel ASTM 53 dan tabel kalibrasi tangki
```

## Backend: Supabase

Tanpa env Supabase aplikasi berjalan di **mode lokal** (data disimpan di
IndexedDB perangkat). Dengan env terisi, data tersinkron dan wajib login.

Skema yang dipakai aplikasi ada di
`supabase/migrations/20260926120000_bbm_init.sql`,
`20260926120500_bbm_private_helpers.sql`, dan
`20261002120000_bbm_plan_meta_daily.sql`:

| Objek | Isi |
|-------|-----|
| `bbm_members` | Anggota dan peran (`pengawas` / `petugas`) |
| `bbm_settings` | Pengaturan SPBU |
| `bbm_plans` | Plan kirim (SO & LO); data MS2, Ship To, PO SAP, supply point di kolom `meta` |
| `bbm_daily` | Stok awal shift (`kind = stok`, satu per shift) dan Q&Q harian (`kind = qq`) |
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
