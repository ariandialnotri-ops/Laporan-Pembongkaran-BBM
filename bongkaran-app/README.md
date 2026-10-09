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
| Dashboard | `/` | Kartu operasional (tanggal & shift), Status Bongkaran Pekan Ini (7 kotak hari dengan ikon status & titik plan kirim; ketuk tanggal untuk plan, penerimaan, kualitas, kuantitas), Bongkaran Hari Ini per produk (dropdown: MT, diterima, transport loss, discharge loss L & %), SLA rata-rata, Rencana vs Realisasi, Kualitas Harian, Kaleng Sample (D15 sample mobil tangki saat bongkar dari 3 bongkaran terakhir), LO Tracking |
| Input | `/input` | Bar wajib Stok Awal Shift + kartu: |
| | `/stok` | Stok awal tiap produk (wajib tiap awal shift) dan pengeluaran dispenser; simpan lalu ke Catatan Persediaan |
| | `/input/bongkar` | Input Bongkaran: mulai bongkaran baru (terkunci sampai stok awal diisi) dan bongkaran berjalan |
| | `/input/:id` | Form bongkaran 14 langkah SOP + tab Finish. Kompartemen: tinggi T2 mobil tangki (acuan deepstick), kapasitas, dan kepekaan (L/mm) dari buku tera MT; selisih liter = kepekaan x selisih mm (0,3 L/mm x -5 mm = -1,5 L). Tanda tangan lewat pop up berkotak panduan. Unduhan: Excel, PDF BA saja (cepat), PDF + foto, JPG. Konfirmasi saat keluar dari form yang belum selesai; bongkaran selesai tidak dapat dihapus |
| | `/plan` | Plan Pengiriman: permintaan MS2 (bottom sheet), shift permintaan dipilih per produk (tidak ada shift tingkat plan); tabel LO (tgl kirim, SO, LO, produk, volume, shift, supply point, MS2, status), volume permintaan dipecah otomatis **tiap 8.000 L = 1 LO** (maks. 8.000 L per LO). Ketuk baris untuk membuka halaman **Edit SO & LO** (nomor segel tidak diisi di sini; dicocokkan dengan dokumen LO fisik saat bongkar). Plan dengan tanggal kirim mendatang (mis. besok) selalu tampil, apa pun filter presetnya. Pengingat harian pukul 06:00 bila plan besok belum dibuat |
| | `/plan/so/:id` | Edit SO & LO satu permintaan dalam bentuk tabel: Nomor SO, lalu per LO produk, volume (maks. 8.000 L), shift, nomor LO, status, alih supply; LO Closed terkunci. Simpan otomatis kembali ke Tracking LO asal (Plan Pengiriman atau Riwayat Tracking LO) |
| | `/kualitas` | Kualitas Harian: density & suhu per produk, tera bejana 20 L per nozzle; tiap baris disimpan sendiri, foto struk & pengembalian minyak wajib di akhir uji |
| | `/sample` | Uji Kualitas Pasca Penerimaan: uji density tangki pendam setelah bongkar selesai, jam uji diatur petugas, wajib untuk setiap penerimaan; dibanding D15 depot |
| | `/apar` | Dashboard APAR & APAB: kondisi baik/temuan, belum diperiksa bulan ini, isi ulang lewat/≤30 hari, **uji instansi (12 bulan) lewat/≤30 hari/belum dicatat**, per area, daftar unit; tombol Inspeksi unit, Pindai QR (lihat data unit), Label QR & Data utama (ABH) |
| | `/apar/inspeksi` | Inspeksi **per unit di lokasi**: tombol Pindai QR unit, atau ketik kode bila label rusak; progres bulan ini (belum/sudah per unit). Tidak ada inspeksi massal |
| | `/apar/inspeksi/:id` | Form satu unit: checklist (posisi, tanda, tekanan, pin & segel, tabung, selang, label, kartu, masa isi ulang, roda APAB), catatan (wajib bila temuan), **foto wajib**, petugas; **Kirim** menyimpan unit itu saja lalu kembali ke pemindai. Unit yang sudah dikirim hari ini tampil hasilnya + tombol koreksi |
| | `/apar/data` | Data utama (ABH & Pengawas): **daftar unit tersimpan** (tabel, saring APAR/cadangan/APAB) dan daftar area (tambah lewat bottom sheet, hapus bila kosong); jumlah pulau dari Pengaturan SPBU |
| | `/apar/data/unit/:id` | Form tambah (`baru`) / ubah unit: tipe, kode (unik), kapasitas, jenis, lokasi, jadwal isi ulang, **tanggal pemeriksaan instansi berwenang + nama instansi (berlaku maks. 12 bulan)**, cadangan; Simpan kembali ke daftar; hapus, label QR |
| | `/apar/label` | Label QR per unit untuk dicetak/disimpan PDF dan ditempel di tabung |
| | `/apar/unit/:id` | Tujuan QR (kamera HP): data unit, kondisi terakhir (temuan, catatan, foto), riwayat, tombol Inspeksi unit ini |
| Laporan | `/laporan` | Kartu laporan: |
| | `/laporan/persediaan` | Catatan Persediaan BBM, unduh Excel/PDF sesuai template |
| | `/laporan/ba` | Berita Acara: status tanda tangan, buka untuk TTD pengawas/ABH atau unduh |
| | `/laporan/bongkaran` | Riwayat Pembongkaran MT: produk, tanggal penerimaan, SO, LO, nopol & supir, volume, transport loss, discharge loss (L, %), SLA (request MS2 / gate out sampai selesai bongkar), keterangan, progress |
| | `/laporan/lo` | Riwayat Tracking LO: tanggal permintaan kirim, SO, LO, produk, volume, supply point, nopol MT, status; ketuk baris untuk ubah lewat pop up (LO Closed terkunci) |
| | `/laporan/kualitas` | Riwayat Kualitas Harian: uji harian dan uji pasca penerimaan; baris yang baru dikirim disorot biru. Ketuk baris → `/laporan/kualitas/:kunci` (highlight data: D15 besar, selisih vs acuan, status, density, suhu, petugas, foto; info bongkaran kecil) |
| | `/laporan/tera` | Riwayat Tera: bejana 20 L per nozzle, batas -60 ml |
| | `/laporan/apar` | Riwayat Inspeksi APAR & APAB: satu baris per unit per inspeksi, filter temuan |
| | `/insiden/baru` | **Lapor Insiden / Near miss / Kerusakan** (semua peran): jenis, kategori, tanggal & jam, lokasi, peralatan, uraian, dampak (wajib untuk insiden), penyebab, tindakan, tingkat risiko, foto (wajib untuk insiden & kerusakan), pelapor; kirim lalu ke riwayat |
| | `/laporan/insiden` | Riwayat insiden: filter tanggal/jenis/status, baris terbuka oranye, baru biru; `/laporan/insiden/:id` detail + tindak lanjut (status, PIC, target, catatan) oleh ABH/Pengawas/Kashift |
| Profil | `/profil` | Akun & peran, ganti kata sandi, statistik, Kalkulator; Pengaturan, Anggota, Data utama APAR (ABH) |
| | `/kalkulator` | Density @15°C (ASTM 53) dan volume tangki pendam |
| | `/pengaturan` | Menu Pengaturan SPBU (ABH): **Identitas SPBU** (`/pengaturan/identitas`: nama, kode, alamat, jumlah pulau, logo, nama default), **Data Dispenser** (`/pengaturan/dispenser`: unit, merk, nomor seri, pulau), **Nozzle & Tera Metrologi** (`/pengaturan/nozzle`: produk, dispenser, no. & tanggal sertifikat tera, berlaku maks. 1 tahun), Sold To & Ship To, Data utama APAR, **Aturan Pemeriksaan** (`/pengaturan/aturan`), **Data Acuan** (`/pengaturan/acuan`) |
| | `/pengaturan/sold-ship-to` | ABH & Pengawas: No. Sold To (satu) dan Ship To per produk; mengisi otomatis form bongkaran (setelah LO dipilih) dan permintaan MS2 |
| | `/anggota` | Khusus ABH: **buat akun** (email + kata sandi sementara, langsung aktif) per peran, ubah peran, atur ulang kata sandi, hapus anggota; daftar hak akses per peran |

Uji Kualitas Pasca Penerimaan disimpan di data bongkaran (`report.data.sample2Jam`, ringkasan
`summary.sample2Jam`), tanpa tabel baru. Kaleng Sample di Dashboard berisi sampel
mobil tangki yang diuji saat bongkar (D15 MT vs D15 depot), terpisah dari uji pasca penerimaan.
Inspeksi APAR & APAB disimpan di `bbm_daily` dengan `kind = 'apar'`, satu record per unit per tanggal (`apar_<tanggal>_<unitId>`); record lama `apar_<tanggal>` (semua unit) tetap terbaca. Data utama (area, unit) ada di pengaturan.
Label QR berisi alamat `https://<domain aplikasi>/apar/unit/<id>`: cetak label dari aplikasi produksi agar QR mengarah ke domain yang benar.
Pemindai di aplikasi memakai BarcodeDetector (Chrome Android); bila tidak didukung, pindai dengan aplikasi kamera HP atau ketik kode unit.

## Alur SOP bongkaran

Setiap langkah wajib foto evidence dan data isian; langkah berikutnya terkunci
sampai langkah sebelumnya lengkap. Semua isian tersimpan otomatis.

| Fase | Langkah |
|------|---------|
| Bongkaran | 1 MT tiba + nopol, 2 Dokumen LO (pilih SO & LO dari plan, Ship To, volume DO liter, shift bongkar otomatis; tombol **Ubah nomor LO / pindah station** bila MT dialihkan ke station lain, tersimpan ke Plan & Tracking LO dengan LO lama tetap tercatat), 3 Buku tera + kapasitas kompartemen, 4 ATG sebelum + totalisator awal nozzle, 5 Safety, 6 Segel atas & bawah (nomor segel per kompartemen dicocokkan dengan dokumen LO fisik), 7 Deepstick tangki sebelum, 8 Water content & draining, 9 Deepstick kompartemen MT |
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
  pages/                 Dashboard, InputMenu, FormInput, FormBongkar, Plan, EditLo, QqHarian, Sample2Jam, StokShift,
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

Data dari perangkat lain (akun sama, HP/PC berbeda) dimuat ulang otomatis saat
aplikasi kembali tampil, saat koneksi kembali online, saat Dashboard / Plan /
Tracking LO dibuka, dan tiap 60 detik selama aplikasi terbuka (jeda minimal 10 detik).

Skema yang dipakai aplikasi ada di
`supabase/migrations/20260926120000_bbm_init.sql`,
`20260926120500_bbm_private_helpers.sql`,
`20261002120000_bbm_plan_meta_daily.sql`, dan
`20261005120000_bbm_daily_apar.sql` (kind `apar` untuk inspeksi APAR & APAB), dan
`20261008120000_bbm_peran.sql` (4 peran + aturan tulis per peran), dan
`20261009120000_bbm_save_apar.sql`, `20261009130000_bbm_save_settings_terbatas.sql` (RPC: pengawas menyimpan unit & area APAR serta Sold To/Ship To saja), dan `20261009140000_bbm_daily_insiden.sql` (kind `insiden`, semua peran boleh melapor). Edge function
`supabase/functions/bbm-akun` membuat akun & mengatur ulang kata sandi (khusus ABH):

| Objek | Isi |
|-------|-----|
| `bbm_members` | Anggota dan peran (`abh` / `pengawas` / `kashift` / `security`) |
| `bbm_settings` | Pengaturan SPBU |
| `bbm_plans` | Plan kirim (SO & LO); data MS2, Ship To, PO SAP, supply point di kolom `meta` |
| `bbm_daily` | Stok awal shift (`kind = stok`, satu per shift) dan Q&Q harian (`kind = qq`) |
| `bbm_reports` | Satu baris per bongkaran; isi langkah SOP di kolom JSON |
| bucket `bbm-evidence` | Foto evidence (privat, diakses lewat signed URL) |

RLS aktif: hanya anggota yang bisa membaca. Peran:

| Peran | Modul |
|-------|-------|
| ABH | Semua modul + Anggota (buat akun), Pengaturan SPBU, Data utama APAR, Label QR |
| Pengawas | Dashboard, stok awal, Input Bongkaran & TTD BA, Plan Pengiriman & Tracking SO/LO, Data utama APAR/APAB & area, Label QR, Kualitas Harian, Uji Pasca Penerimaan, lihat APAR, semua laporan |
| Kepala Shift | Stok awal, Input Bongkaran, Kualitas Harian, Plan & Tracking SO/LO, Inspeksi APAR/APAB, laporan terkait |
| Security | Inspeksi APAR/APAB saja |

Tulis: plan & laporan oleh ABH/Pengawas/Kashift; Security hanya `bbm_daily`
kind `apar`; pengaturan & anggota hanya ABH; hapus plan/laporan oleh ABH/Pengawas
(draft milik sendiri boleh dihapus pembuatnya). Daftar halaman per peran ada di
`src/lib/roles.ts`. Pengguna pertama yang login otomatis menjadi ABH, lalu
membuat akun lain di `/anggota`.

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
