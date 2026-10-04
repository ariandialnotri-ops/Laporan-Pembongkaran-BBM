# FLOQ: Design Spec (untuk ganti desain UI)

> **FLOQ (Fuel Logistic Quality & Quantity)**: aplikasi evidence pembongkaran BBM dan Q&Q harian di SPBU.
> Dokumen ini menjelaskan **seluruh tampilan aplikasi saat ini**: token, komponen, setiap layar, dan aturan yang wajib dipertahankan.
> Pakai sebagai brief untuk desainer atau tool desain AI (Google Stitch, Figma AI, v0, dan lain-lain). Setelah desain baru jadi, ikuti **bagian 12** untuk memasangnya ke kode.

Versi: Oktober 2026 · Stack: React 19 + Vite + Tailwind CSS v4 + Radix UI + lucide-react

---

## Daftar isi

1. [Konteks pengguna](#1-konteks-pengguna)
2. [Yang boleh diganti dan yang wajib tetap](#2-yang-boleh-diganti-dan-yang-wajib-tetap)
3. [Brand](#3-brand)
4. [Token warna](#4-token-warna)
5. [Tipografi](#5-tipografi)
6. [Spasi, radius, elevasi, gerak](#6-spasi-radius-elevasi-gerak)
7. [Kerangka aplikasi & navigasi](#7-kerangka-aplikasi--navigasi)
8. [Komponen](#8-komponen)
9. [Layar per layar](#9-layar-per-layar)
10. [Status & makna warna](#10-status--makna-warna)
11. [Aturan konten, aksesibilitas, HP spesifikasi rendah](#11-aturan-konten-aksesibilitas-hp-spesifikasi-rendah)
12. [Cara memasang desain baru ke kode](#12-cara-memasang-desain-baru-ke-kode)
13. [Prompt siap pakai untuk tool desain AI](#13-prompt-siap-pakai-untuk-tool-desain-ai)

---

## 1. Konteks pengguna

| Hal | Isi |
|---|---|
| Pengguna | Petugas penerima / kepala shift SPBU, pengawas, security, supir MT (tanda tangan), Area Business Head |
| Perangkat | Utama **HP Android kelas menengah ke bawah** (layar 360-412 px, RAM kecil); sekunder laptop pengawas (≥ 1280 px) |
| Tempat pakai | Area pompa / tangki pendam: di luar ruangan, silau matahari, sering memakai sarung tangan, satu tangan memegang dokumen |
| Waktu pakai | Saat mobil tangki (MT) tiba, sepanjang shift (06:00-13:59, 14:00-21:59, 22:00-05:59) |
| Bahasa | Bahasa Indonesia, angka format Indonesia (`16.000 L`, `0,7450`) |
| Mode tampilan | Operasional (bukan pemasaran): cepat dibaca, jelas statusnya, tahan salah ketik |

Pertanyaan yang harus dijawab tiap layar dalam 3 detik:
- **Dashboard**: kondisi mutu & penerimaan hari ini baik atau tidak?
- **Input**: apa yang harus saya isi sekarang?
- **Laporan**: di mana data / file yang saya cari?

---

## 2. Yang boleh diganti dan yang wajib tetap

**Boleh diganti bebas**
- Gaya visual: warna, font, efek kaca (glass), bayangan, radius, ikon, ilustrasi, animasi.
- Tata letak di dalam kartu, ukuran kartu, kepadatan informasi (selama data tetap ada).
- Bentuk komponen (mis. tab, chip, kartu menu, tabel).

**Wajib tetap (fungsi & alur)**
- 4 menu dock: **Dashboard, Input, Laporan, Profil** (urutan dan peran).
- Dashboard **hanya data** (tanpa tombol input). Semua pengisian di **Input**, semua riwayat/unduhan di **Laporan**, Kalkulator hanya di **Profil**.
- Urutan bagian Dashboard (lihat 9.2).
- 14 langkah SOP bongkaran dan urutannya (lihat 9.5).
- Semua field data, status, peringatan, dan validasi.
- Target sentuh minimal **44 × 44 px**, teks input **16 px** (cegah zoom iOS).
- Kontras teks minimal **4,5 : 1** (teks kecil) di atas permukaan apa pun.
- Teks merek tanpa tanda em-dash (`—`).

---

## 3. Brand

| Aset | File | Pakai di |
|---|---|---|
| Logo login (ikon FQ + tagline) | `public/floq-login.webp` | Halaman login, layar memuat |
| Ikon aplikasi | `public/floq-icon.webp` (36 px di header) | Header kiri atas |
| Favicon / ikon layar utama | `public/favicon.png`, `public/apple-touch-icon.png`, `public/floq-icon-256.png` | Browser, PWA |

- Nama: **FLOQ**, tagline *Fuel Logistic Quality & Quantity*.
- Copyright di bawah form login: `© <tahun> FLOQ · Created by Ariandi Alnotri` (tahun otomatis).
- Palet brand sheet: latar `#F5F5F7`, teks `#1D1D1F`, teks sekunder `#AAAAAA`, aksen `#007AFF`.

---

## 4. Token warna

Semua warna adalah **token peran** (gaya Material 3). Kode memakai nama peran, bukan hex, jadi mengganti hex di satu file mengubah seluruh aplikasi. File: `src/index.css` (blok `:root`).

### 4.1 Permukaan & teks

| Token | Hex sekarang | Dipakai untuk |
|---|---|---|
| `background` / `surface` | `#F8F9FF` | Latar halaman (di atas gradasi kanvas) |
| `surface-container-lowest` | `#FFFFFF` | Kartu paling terang, isi tabel |
| `surface-container-low` | `#EFF4FF` | Kotak angka kecil, baris ringkasan |
| `surface-container` | `#E5EEFF` | Tombol "soft" saat hover |
| `surface-container-high` | `#DCE9FF` | Lintasan progress bar, pill netral |
| `surface-container-highest` | `#D2E4FF` | Permukaan paling gelap |
| `on-surface` | `#0A1C30` | Teks utama |
| `on-surface-variant` | `#424656` | Teks sekunder, label |
| `outline` | `#727687` | Garis tegas |
| `outline-variant` | `#C2C6D8` | Pemisah tipis, garis putus-putus slot kosong |

Kanvas halaman: gradasi `radial(rgba(179,197,255,.35) di atas)` + `linear(#E9EFF6 → #DDE7F3)`.

### 4.2 Warna peran

| Peran | Token utama | Hex | Container / fixed | Makna |
|---|---|---|---|---|
| Primary (aksi) | `primary` | `#0050CB` | `primary-container #0066FF`, `primary-fixed #DAE1FF`, `on-primary-fixed #001849` | Tombol utama, tautan, tab aktif, hari ini di kalender |
| Secondary (info / menunggu) | `secondary` | `#006A64` | `secondary-fixed #65F8ED`, `on-secondary-fixed-variant #00504B` | Status "Menunggu sample", pill cyan |
| Tertiary (sesuai / beres) | `tertiary` | `#006645` | `tertiary-fixed #6FFBBE`, `on-tertiary-fixed-variant #005236` | Pill "Sesuai", "Segel sesuai", selisih aman |
| Error (anomali) | `error` | `#BA1A1A` | `error-container #FFDAD6`, `on-error-container #93000A` | Anomali, wajib diisi, di bawah batas, gagal |

Peringatan "perlu perhatian, belum salah" memakai **amber** Tailwind (`amber-50/300/500/700`): pengingat plan besok, retensi kaleng 3, slot kosong.

### 4.3 Warna produk (identitas, bukan status)

Hanya untuk ikon produk, chip spesifikasi, dan isi ilustrasi kaleng. File: `src/lib/produk.ts`.

| Produk | Kode | Spesifikasi | Warna |
|---|---|---|---|
| Pertalite | PLT | RON 90 | emerald (hijau) |
| Pertamax | PMX | RON 92 | sky (biru) |
| Pertamax Turbo | PMT | RON 98 | red (merah) |
| Biosolar | SOL | CN 48 | amber (kuning) |
| Pertamina Dex | DEX | CN 53 | teal |

Warna produk **tidak boleh** dipakai untuk status (sesuai/anomali).

---

## 5. Tipografi

| Keluarga | Font | Untuk |
|---|---|---|
| UI | **Plus Jakarta Sans** (variable) | Semua teks |
| Angka | **JetBrains Mono** (variable), `tabular-nums` | Liter, density, jam, nopol, nomor SO/LO (kelas `tabular`) |

| Token | Ukuran / line-height | Berat | Untuk |
|---|---|---|---|
| `headline-xl` | 36 / 44 | 700 | Angka pahlawan di layar lebar |
| `headline-lg` | 28 / 36 | 600 | (cadangan) |
| `headline-md` | 20 / 26 | 600 | Judul header, judul bagian, judul kartu |
| `body-lg` | 16 / 24 | 400-700 | Nama produk di kartu Kaleng |
| `body-md` | 14 / 20 | 400-700 | Teks utama |
| `body-sm` | 12 / 16 | 400-600 | Teks sekunder, isi tabel |
| `numeric-lg` | 24 / 30 | 600 | Total liter |
| `numeric-md` | 16 / 22 | 500 | Angka di tile |
| `numeric-sm` | 12 / 16 | 500 | Angka kecil |
| `tag` | 12 / 16 | 700, huruf besar, `+0.05em` | Label kecil, header tabel, pill |

---

## 6. Spasi, radius, elevasi, gerak

**Spasi** (`space-*`): `2xs 4px` · `xs 6px` · `sm 8px` · `md 16px` · `lg 24px` · `xl 32px` · `2xl 48px` · margin halaman 16 px.

**Radius**: `sm 4px` · default `8px` · `md 12px` · `lg 16px` (kartu) · `xl 24px` (bottom sheet) · `full` (pill, dock, chip).

**Elevasi kaca** (latar semi transparan + blur + garis tepi putih):

| Level | Latar | Blur (HP) | Dipakai |
|---|---|---|---|
| `glass-1` | putih 55% | 10 px | Kartu sekunder, chip, tombol bulat |
| `glass-2` | putih 72% | 14 px | Kartu utama, dock |
| `glass-3` | putih 88% | 18 px | Bottom sheet, dropdown, toast |
| `inset-field` | `rgba(235,242,250,.65)` + bayangan dalam | n/a | Kolom input, slot data |

Mode **Kurangi Transparansi** (pengaturan HP): semua kaca jadi warna padat `#F7F9FD` / `#FBFCFE` / `#FFFFFF`.

**Gerak**: masuk bertahap `fadeInUp` 0,5 s (`cubic-bezier(.16,1,.3,1)`, 5 tingkat jeda); tekan `scale(.97)`; sheet geser dari bawah. Semua dimatikan saat **Kurangi Gerakan** aktif.

**Lapisan (z-index)**: header 40 · dock 50 · overlay sheet 60 · sheet 61 · dropdown 70 · toast 80.

---

## 7. Kerangka aplikasi & navigasi

```
┌──────────────────────────────┐
│ [logo|←] Judul halaman  (ML) │  Header 64 px, tetap di atas, kaca
│          NAMA SPBU           │  ← tombol kembali menggantikan logo di halaman turunan
├──────────────────────────────┤
│                              │
│      Konten (maks 1024 px)   │  margin 16 px, jarak antar bagian 16-24 px
│                              │
├──────────────────────────────┤
│ ( Dashboard Input Laporan Profil ) │  Dock melayang, pill kaca, 4 item ikon + label
└──────────────────────────────┘
```

- **Header**: kiri logo (halaman menu) **atau** tombol kembali (halaman turunan); judul halaman; nama SPBU huruf besar biru. Kanan: chip inisial pengguna (ke Profil).
- **Tombol kembali**: kembali ke halaman asal (riwayat navigasi). Tanpa riwayat: ke menu induk.
- **Dock**: 4 item, item aktif berlatar `primary/10` dan teks biru. Label 12 px huruf besar.
- **Bottom sheet**: semua form tambahan / ubah / detail muncul dari bawah (maks 88% tinggi layar, lebar maks 576 px), judul + deskripsi + tombol tutup ×, footer tombol.
- **Toast**: atas tengah, kaca, ikon + teks, hilang otomatis.
- **Breakpoint**: HP < 768 px (satu kolom, kartu); `md` ≥ 768 px (tabel rekap); `lg` ≥ 1024 px (grid 3-4 kolom).

Peta halaman:

| Menu | Halaman | Rute |
|---|---|---|
| Dashboard | Dashboard | `/` |
| Input | Menu Input (kartu) | `/input` |
| | Stok Awal Shift | `/stok` |
| | Input Bongkaran (mulai / berjalan) | `/input/bongkar` |
| | Form bongkaran 14 langkah + Finish | `/input/:id` |
| | Plan Pengiriman | `/plan` |
| | Kualitas Harian | `/kualitas` |
| | Sample BBM 2 Jam | `/sample` |
| Laporan | Menu Laporan (kartu) | `/laporan` |
| | Catatan Persediaan BBM | `/laporan/persediaan` |
| | Berita Acara | `/laporan/ba` |
| | Riwayat Pembongkaran MT | `/laporan/bongkaran` |
| | Riwayat Tracking LO | `/laporan/lo` |
| | Riwayat Kualitas Harian | `/laporan/kualitas` |
| | Riwayat Tera | `/laporan/tera` |
| Profil | Profil, Kalkulator, Pengaturan SPBU, Anggota | `/profil`, `/kalkulator`, `/pengaturan`, `/anggota` |
| (tanpa dock) | Login | saat belum masuk |

---

## 8. Komponen

File di `src/components/ui/` (dasar) dan `src/components/bongkaran/` (khusus FLOQ).

| Komponen | File | Anatomi & varian | Status |
|---|---|---|---|
| **Button** | `ui/button.tsx` | Varian: `primary` (biru padat + bayangan), `glass`, `soft`, `ghost`, `danger`. Ukuran: `default` 44 px, `lg` 56 px, `sm`/`pill` 44 px bulat, `icon` 44 × 44 | disabled 50% opasitas, tekan scale .97 |
| **Input** | `ui/input.tsx` | Kotak `inset-field` 48 px, teks 16 px, satuan di kanan (`L`, `mm`, `°C`, `ml`) | fokus: latar putih + cincin biru |
| **Select** | `ui/select.tsx` | Pemicu seperti Input + chevron; daftar kaca `glass-3` | daftar selalu di atas sheet |
| **Choice** | `bongkaran/form-bits.tsx` | Segmented pill (Shift 1/2/3) di dalam `inset-field` | terpilih: putih + teks biru |
| **Field** | `form-bits.tsx` | Label `tag` + isi + hint kecil | |
| **Ladder** | `form-bits.tsx` | Daftar label-nilai di kotak inset + baris total tebal | |
| **CheckRow** | `form-bits.tsx` | Checkbox besar + teks konfirmasi | |
| **Pill** | `ui/pill.tsx` | Kapsul `tag` huruf besar + ikon opsional, satu baris. Nada: `neutral`, `primary`, `info`, `success`, `error`, `cyan` | |
| **GlassCard** | `ui/glass-card.tsx` | Kartu kaca level 1/2/3, radius 16 | |
| **Sheet** | `ui/sheet.tsx` | Bottom sheet: pegangan, judul, deskripsi, ×, isi gulir, footer | |
| **Toast** | `ui/toast.tsx` | Kaca, ikon + pesan | |
| **Tabs** | `ui/tabs.tsx` | Segmented dengan indikator geser (form: Bongkaran/Quality/Quantity/Finish) | |
| **SectionHeader** | `section-header.tsx` | Judul bagian `headline-md` + aksi kanan | |
| **StatTile** | `stat-tile.tsx` | Label tag + ikon + angka + hint | nada primary/error |
| **MenuCard** | `menu-card.tsx` | Kartu menu Input/Laporan: ikon biru 44 px, judul, satu kalimat, baris status (biru = beres, merah = perlu dikerjakan) + lencana angka merah | |
| **RecordTable** | `record-table.tsx` | Riwayat: judul huruf besar + chip "n dari total"; **HP = daftar kartu** (judul, baris keterangan, lencana kanan, chevron); **≥ md = tabel** (header tag, kolom BBM berupa chip, kolom Aksi) | baris bisa membuka halaman atau pop up |
| **ChipFilter** | `chip-filter.tsx` | Baris chip pilihan tunggal, bisa digeser | aktif: biru padat |
| **DateFilter** | `date-filter.tsx` | Chip Hari ini / 7 hari / Bulan ini / Semua / Pilih tanggal (+ 2 kolom tanggal) | |
| **StatusBanner** | `status-banner.tsx` | Kotak status ikon + judul + detail; nada idle/success/error | |
| **StokGate** | `stok-gate.tsx` | Kartu merah "Stok awal Shift N belum diisi" + tombol "Isi stok awal" | |
| **PhotoSlot** | `photo-slot.tsx` | Label + pill Wajib/n foto + grid thumbnail (hapus ×) + tombol kamera besar garis putus-putus | memproses: spinner |
| **SignaturePad** | `signature-pad.tsx` | Kanvas putih 144 px + Hapus; setelah tanda tangan tampil gambar + "Ulangi" | |
| **StepRail** | `pages/FormBongkar.tsx` | 14 bulatan nomor bisa digeser, pemisah antar fase, aktif biru besar | lengkap/terkunci |
| **Kaleng (ilustrasi)** | `kaleng-sample.tsx` | Kaleng: tutup, label `K1/K2/K3`, isi warna produk | |
| **LoEditSheet** | `lo-edit-sheet.tsx` | Pop up ubah LO: produk, volume, nomor LO, shift, status (grid kartu), alih supply, segel | LO Closed: tampilan kunci saja |
| **KalengDetail** | `kaleng-detail.tsx` | Pop up detail uji kaleng (lihat 9.2) | |
| **PlanReminder** | `shell/plan-reminder.tsx` | Tanpa tampilan: toast + notifikasi 06:00 | |

---

## 9. Layar per layar

Format tiap layar: **tujuan**, **isi berurutan**, **status khusus**.

### 9.1 Login
- Tengah layar: logo FLOQ, kartu kaca berisi **Email**, **Password**, tombol **Masuk**.
- Bawah layar: 3 lapis gelombang biru lembut (opasitas 0,14 / 0,20 / 0,28). Copyright di bawah kartu.
- Status: memuat, salah password (pesan merah), akun belum terdaftar sebagai anggota SPBU.

### 9.2 Dashboard (hanya data)
Urutan **wajib**:
1. **Tanggal terkini** (mis. "Minggu, 4 Oktober 2026") + shift berjalan di kanan.
2. **Kalender Progress** (1 minggu, Sen-Min), panah minggu sebelum/berikut + bulan-tahun singkat.
   - Bulatan tanggal: biru muda = sesuai, merah muda = ada anomali, abu = belum ada data, biru padat = hari ini.
   - Titik kuning di bawah tanggal = ada plan kirim.
   - Ketuk tanggal → sheet: **Plan pengiriman** (produk, volume, shift, SO, LO, supply point, status), **Penerimaan** (bongkaran + Q&Q), **Kualitas** (D15 bongkar & uji harian), **Kuantitas** (tera bejana, stok awal per produk).
3. **Total Bongkaran**: DateFilter (default Hari ini); 3 angka (Diterima, Transport loss, Discharge loss + %); tabel per produk (Produk + "n× bongkar", Diterima L, Transport, Discharge L & %); 2 kotak **SLA** rata-rata (Request MS2 → selesai bongkar, Gate out depot → selesai bongkar).
4. **Plan Pengiriman Hari Ini**: per produk "x dari y LO dibongkar (+ n berjalan)", progress bar, "volume selesai dari volume plan".
5. **Kualitas Harian**: daftar 5 produk: uji terakhir (tanggal, shift), D15, selisih vs D15 bongkaran terakhir, pill Sesuai/Tidak sesuai/Belum.
6. **Kaleng Sample**:
   - Kartu kepala: ikon, judul, keterangan toleransi, **tombol ⓘ** (pop up ketentuan 4 poin), 4 kotak ringkasan (Sampel sesuai, Ada anomali, Menunggu sample 2 jam, Pembaruan).
   - Kartu akordeon per produk: ikon warna produk, nama + chip spesifikasi, nama tangki; kanan: D15 terkini (selisih), Bongkar terakhir, pill status, chevron.
   - Isi: label "Kiri terbaru, kanan terlama" + status slot; **3 kaleng** (HP: geser ke samping, kartu 85% lebar; layar lebar: 3 kolom).
     - **Kaleng 1** (terbaru): garis tepi tebal warna produk (merah bila anomali), lencana "Kaleng 1, terbaru" + "Segel sesuai", ilustrasi kaleng, D15 sample 2 jam besar + selisih vs depot, lalu baris **Waktu bongkar, No SO, No LO, Mobil tangki (nopol / komp.)**, tautan "Lihat detail uji".
     - **Kaleng 2-3**: versi ringkas; kaleng 3 menampilkan "Retensi: dibuang saat kaleng baru masuk" (amber).
     - **Slot kosong**: garis putus-putus, "Slot kaleng n kosong", tanggal plan kirim berikutnya.
     - Bila sample 2 jam belum diambil: "Menunggu sample 2 jam" (nada cyan) menggantikan D15.
   - **Pop up detail uji** (judul "Kaleng n Produk", status di atas):
     1. **Data DO Mobil Tangki**: Nomor SO, Nomor LO (tebal), Tanggal & waktu penerimaan (+ selesai bongkar), Supply point, Nopol, Driver (+ pengangkut), Tangki tujuan, tabel Kompartemen-Nomor segel.
     2. **Parameter Uji Density** (toleransi di kanan): blok *Sample tangki 2 jam (acuan)*, *D15 dokumen depot*, *Uji saat bongkar per kompartemen*. Tiap blok: "Density observe: x g/ml" lalu "Suhu: y °C" di bawahnya, **kotak D15 disorot** di kanan (+ selisih vs depot). Lalu Air & sampel.
     3. **Data Retensi Kaleng Sampel**: posisi kaleng, masa simpan, kondisi segel, petugas sample.
     - Footer: Berita Acara, Tutup.
7. **LO Tracking**: kartu 6 kotak status (Proses, OS, Planned, On Delivery, Delivered, Closed) + jumlah; ketuk ke Riwayat Tracking LO.

### 9.3 Menu Input
- **Bar wajib Stok Awal Shift** paling atas: merah "Isi stok awal Shift n" / netral "Stok awal Shift n terisi".
- Grid 2 kolom, 4 **MenuCard**: Input Bongkaran, Plan Pengiriman, Kualitas Harian, Sample BBM 2 Jam. Tiap kartu menampilkan status hidup, mis. "1 bongkaran belum selesai", "Plan besok belum dibuat", "Shift 1 belum diuji", "1 siap, 2 menunggu 2 jam".

### 9.4 Stok Awal Shift
- Kartu shift: judul "Shift n (jam)", tanggal, pill Tersimpan/Wajib diisi, pilihan tanggal & shift (Choice).
- Satu kartu per tangki: Tinggi ATG/deepstick (mm, volume terisi otomatis dari tabel kalibrasi), **Stok awal** (L), Pengeluaran dispenser (diisi akhir shift).
- Petugas, tombol Simpan. Riwayat stok + DateFilter.

### 9.5 Input Bongkaran & Form bongkaran
**Input Bongkaran**: kartu "Bongkaran baru" (pill jumlah SO siap), StokGate bila stok belum diisi, tombol **Mulai bongkaran baru** (terkunci tanpa stok), daftar **Bongkaran Berjalan**.

**Form** (`/input/:id`):
- Atas: tab fase **Bongkaran / Quality / Quantity / Finish**; status simpan otomatis + nopol.
- Kartu langkah: "Langkah n dari 14", judul, penjelasan, **StepRail** 14 nomor.
- Isi langkah: PhotoSlot wajib + field + banner status. Bawah: tombol kembali (←) + tombol utama "Simpan & lanjut".

| # | Fase | Langkah | Isi utama |
|---|---|---|---|
| 1 | Bongkaran | Foto Mobil Tangki | Foto depan MT, **nopol** |
| 2 | | Dokumen LO & Data Bongkaran | Foto LO, pilih SO & LO dari Plan, tanggal/jam datang (shift otomatis), driver, pengangkut, Ship To, produk/SO/LO (otomatis), volume DO, density & suhu depot, D15 dokumen, gate out depot, kompartemen |
| 3 | | Buku Tera Mobil Tangki | Tinggi tera & kapasitas per kompartemen |
| 4 | | ATG Sebelum Pembongkaran | Tangki pendam, tinggi/volume/suhu ATG, totalisator awal nozzle |
| 5 | | Kelengkapan Safety | APAR, arde, atribut safety |
| 6 | | Segel Kompartemen | Kotak merah daftar segel dari LO, foto, nomor segel per kompartemen, konfirmasi |
| 7 | | Deepstick Tangki Pendam (Sebelum) | Tinggi deepstick + volume |
| 8 | | Water Content Kompartemen MT | Nihil / Ada air (+ foto draining) |
| 9 | | Deepstick Kompartemen MT vs Buku Tera | Hasil deepstick, izin penanggung jawab bila selisih > batas |
| 10 | Quality | Sampel Minyak Kompartemen | Foto sampel atas & bawah |
| 11 | | Kualitas Density | Density & suhu per kompartemen → D15, selisih vs depot (anomali = berhenti) |
| 12 | Quantity | Hose & Fillport | Foto + konfirmasi |
| 13 | | ATG Setelah Pengisian | Jam selesai, jam baca ATG (≥ 10 menit), ATG setelah, totalisator akhir |
| 14 | | Dipping Manual Tangki Pendam (Sesudah) | Dipping + **tanda tangan** penerima, security, supir (wajib); pengawas & ABH (bisa nanti) |

**Finish**: status shift; tangga perhitungan (stok awal, DO, stok teoritis, real stok, **Discharge gain/loss L & % volume DO**); transport loss + banner bila melewati batas; tombol unduh **Excel / PDF / JPG**; teks WhatsApp + Kirim WA; tanda tangan pengawas & ABH.
**Bongkaran selesai terkunci**: tidak bisa diubah; label "Bongkaran selesai, data terkunci". Buka kembali hanya untuk BA anomali oleh pengawas.

### 9.6 Plan Pengiriman
- Banner amber (≥ 06:00 bila plan besok belum ada): "Plan pengiriman besok belum dibuat" + Buat plan besok + Aktifkan notifikasi.
- Tombol besar **Permintaan baru (MS2)** → sheet: Tanggal kirim, Supply point, Tanggal & jam MS2, Shift permintaan, Ship To, PO SAP (opsional); **baris produk**: Produk, Volume L, hapus, **Shift 1/2 per produk**; Tambah produk; Simpan.
- Kartu **Status SO & LO**: DateFilter + 8 kotak status (bisa jadi saringan).
- Daftar per tanggal kirim: kartu SO (SO / supply / Ship To / MS2 / PO, tombol ubah) berisi baris LO (produk, volume, shift, LO / alih supply, segel, pill status) + Tambah LO. Ketuk baris → **LoEditSheet**.

### 9.7 Kualitas Harian
- Kartu kepala: "Uji Q&Q Shift n", tanggal, pill Selesai/Sebagian tersimpan/Belum diuji, tanggal, jam uji, shift, petugas.
- **Uji kualitas (density)**: kartu per produk: Produk, Density, Suhu, Pump test, tangga (density observasi, D15, acuan D15 bongkaran, selisih), baris status + **tombol Simpan per baris** ("Tersimpan jam" / "Belum disimpan"). Uji produk lain.
  - **Langkah terakhir**: PhotoSlot wajib *Foto struk pump test* & *Foto pengembalian minyak ke tangki*.
- **Tera takaran (bejana 20 L)**: baris per nozzle: Selisih bejana (ml), Pump test (L), **Simpan per nozzle**, merah bila < -60 ml. Muat semua nozzle / + Nozzle. Langkah terakhir: 2 foto yang sama.
- Ringkasan pump test + tombol **Selesaikan uji** (ditolak bila ada baris belum disimpan / foto belum ada). Riwayat + DateFilter.

### 9.8 Sample BBM 2 Jam
- Penjelasan singkat. **Menunggu sampel**: baris bongkaran (produk, nopol, tanggal, selesai bongkar, pill "Siap diambil" merah / "Mulai HH:MM").
- Ketuk → sheet: tanggal & jam ambil, density, suhu, peringatan bila < 2 jam, tangga (D15 sample, D15 depot, D15 saat bongkar, selisih), petugas, catatan, Simpan.
- **Sudah diuji**: daftar hasil + pill Sesuai/Tidak sesuai.

### 9.9 Menu Laporan
Grid 2 kolom (3 di layar lebar), 6 MenuCard: Catatan Persediaan BBM, Berita Acara (merah bila menunggu tanda tangan), Riwayat Pembongkaran MT, Riwayat Tracking LO, Riwayat Kualitas Harian, Riwayat Tera (merah bila ada nozzle di bawah batas).

### 9.10 Halaman laporan (semua memakai RecordTable)

| Halaman | Penyaring | Kolom (urut) |
|---|---|---|
| **Catatan Persediaan BBM** | Produk (Select), DateFilter | Pratinjau: Tanggal, Shift, Stok awal, Terima, Keluar, Selisih; tombol **Unduh Excel / PDF** (format template asli) |
| **Berita Acara** | DateFilter, 4 kotak status (Semua/Selesai/Anomali/Draft) | BBM, Nopol, Tanggal/Jam, No BA, Volume, Tanda tangan ("Menunggu Pengawas, ABH"), Status |
| **Riwayat Pembongkaran MT** | DateFilter, chip produk | **Produk, Tgl penerimaan, No SO, No LO, Nopol & supir**, Volume, Transport loss, Discharge loss (L & %), SLA (Req / Gate out), Keterangan (pill), Status, Progress tindakan |
| **Riwayat Tracking LO** | DateFilter, chip status (dengan jumlah) | **Tgl permintaan kirim, No SO, No LO, Produk, Volume, Supply point, Nopol MT, Status** (Closed dengan ikon kunci). Ketuk baris → **pop up ubah LO** (bukan pindah halaman) |
| **Riwayat Kualitas Harian** | DateFilter, chip jenis (Uji harian / Sample 2 jam), chip produk | Tanggal, Waktu, Jenis, BBM, Density, Suhu, D15, Acuan, Selisih, Status |
| **Riwayat Tera** | DateFilter, chip Semua / Di bawah batas | Tanggal, Shift, Nozzle, BBM, Selisih (ml), Pump test, Status |

### 9.11 Profil, Kalkulator, Pengaturan, Anggota
- **Profil**: kartu identitas (inisial, nama, email, SPBU), 3 StatTile (Selesai, Kepatuhan, Laporan bulan ini), grup **Alat bantu** (Kalkulator), grup **Akun & SPBU** (Pengaturan SPBU, Anggota, Data acuan, Keluar).
- **Kalkulator**: Density observasi + Suhu → D15 (angka besar); Tangki + Ketinggian → volume dari tabel kalibrasi.
- **Pengaturan SPBU**: Nama SPBU, Kode, Alamat, logo; nama default (Petugas penerima, Pengawas, Security, ABH, Perusahaan pengangkut); **Nozzle Dispenser** (nama + produk, tambah/hapus); Aturan (Toleransi density 15°C, Batas kurang vs tera, Tunggu sebelum baca ATG, Liter per 1 DO, PIN penanggung jawab); Data acuan tabel.
- **Anggota** (pengawas, mode server): daftar email + peran (pengawas/petugas), tambah/hapus.

---

## 10. Status & makna warna

| Makna | Warna / nada | Contoh |
|---|---|---|
| Sesuai / beres / tersimpan | tertiary (hijau) `success` | Sesuai, Segel sesuai, Lolos uji |
| Aksi / info utama / aktif | primary (biru) | Tab aktif, tautan, hari ini, progress |
| Menunggu (bukan salah) | secondary (cyan) | Menunggu sample, LO Planned/Alih supply |
| Perlu perhatian (pengingat) | amber | Plan besok belum dibuat, kaleng akan dibuang, slot kosong |
| Anomali / wajib / gagal | error (merah) | Anomali density, di bawah batas tera, Wajib diisi, Tidak sesuai |
| Netral / belum ada | neutral (abu) | Belum ada sampel, Draft, LO Proses |

**Status LO** (label & nada): Proses (neutral), OS (info), Planned (cyan), On Delivery (primary), Alih Supply (cyan), Deleted (error), Delivered (primary), Closed (success, terkunci).

Aturan: status **tidak pernah hanya warna**. Selalu ada teks dan, bila penting, ikon.

---

## 11. Aturan konten, aksesibilitas, HP spesifikasi rendah

**Konten**
- Bahasa Indonesia baku-santai, kalimat pendek. Tanpa em-dash (`—`); pakai koma atau titik dua.
- Angka: ribuan titik, desimal koma (`16.000 L`, `0,7450`, `+0,07%`). Density 4 desimal. Satuan selalu tampil.
- Tanggal: `4 Okt 2026`; panjang: `Minggu, 4 Oktober 2026`. Jam 24 jam `HH:MM`.

**Aksesibilitas**
- Target sentuh ≥ 44 px; teks input 16 px; fokus terlihat (garis biru 2 px).
- Kontras teks ≥ 4,5 : 1; teks di atas kaca harus tetap terbaca di bawah sinar matahari.
- Semua ikon tanpa teks punya `aria-label`; tabel punya header; meter punya nilai.

**HP spesifikasi rendah**
- Blur kaca dikurangi di layar sentuh (10/14/18 px). Orb latar diam, tanpa animasi.
- Halaman selain Dashboard & menu Input dimuat saat dibuka (lazy). Foto dikompres (maks 1280 px, JPEG 0,72) sebelum diunggah.
- Hindari: video latar, animasi terus-menerus, bayangan berlapis banyak, gambar besar dekoratif.

---

## 12. Cara memasang desain baru ke kode

| Yang diganti | File |
|---|---|
| Warna, font, ukuran teks, spasi, radius, efek kaca, gerak | `src/index.css` (blok `:root`, `@theme inline`, `@utility glass-*`, `@media`) |
| Font | `package.json` (`@fontsource-variable/*`) + `@import` di atas `src/index.css` |
| Tombol, input, select, pill, kartu, sheet, toast, tab | `src/components/ui/*.tsx` |
| Header, dock, latar orb | `src/components/shell/*.tsx` |
| Kartu menu, tabel riwayat, filter, slot foto, kaleng | `src/components/bongkaran/*.tsx` |
| Isi & urutan layar | `src/pages/*.tsx` |
| Nama menu, judul halaman, rute | `src/lib/nav.ts`, `src/App.tsx` |
| Warna produk | `src/lib/produk.ts` |
| Logo & ikon | `public/` |

Langkah aman:
1. Ganti nilai token di `src/index.css` dulu (90% perubahan tampilan cukup di sini, karena komponen memakai nama peran: `bg-primary`, `text-on-surface`, `glass-2`, dll.).
2. Baru ubah bentuk komponen di `src/components/ui/`.
3. Jalankan `npm run dev` lalu cek di lebar 360 px dan 1280 px; `npm run build` dan `npm run lint` harus lulus.
4. Jangan ubah nama token yang sudah dipakai; tambah token baru bila perlu.

---

## 13. Prompt siap pakai untuk tool desain AI

Salin, lalu ganti bagian `[GAYA BARU]`:

```
Redesign aplikasi mobile web "FLOQ" (Fuel Logistic Quality & Quantity) untuk petugas SPBU Pertamina.
Bahasa Indonesia. Layar utama HP 390 px, juga layar laptop 1280 px.

Gaya baru: [GAYA BARU, mis. "material modern, kartu putih solid, aksen biru Pertamina #0050CB,
kontras tinggi untuk di bawah sinar matahari, sudut 12px, tanpa efek kaca"].

Pertahankan struktur:
- Dock bawah 4 menu: Dashboard, Input, Laporan, Profil. Header atas: logo / tombol kembali, judul, nama SPBU, inisial user.
- Dashboard (hanya data, tanpa tombol input), urutan: tanggal terkini; Kalender Progress mingguan
  (status per tanggal + titik plan kirim, ketuk = detail); Total Bongkaran per produk (diterima, transport loss,
  discharge loss L & %, SLA request MS2 dan gate out); Plan Pengiriman Hari Ini per produk (progress dibongkar);
  Kualitas Harian per produk; Kaleng Sample (kartu per produk, 3 kaleng kiri terbaru kanan terlama, D15 sample 2 jam
  vs D15 depot, waktu bongkar, No SO, No LO, mobil tangki; slot kosong; pop up detail uji); LO Tracking (6 status).
- Menu Input: bar wajib Stok Awal Shift + 4 kartu (Input Bongkaran, Plan Pengiriman, Kualitas Harian, Sample BBM 2 Jam)
  dengan status hidup dan lencana merah bila perlu dikerjakan.
- Menu Laporan: 6 kartu (Catatan Persediaan BBM, Berita Acara, Riwayat Pembongkaran MT, Riwayat Tracking LO,
  Riwayat Kualitas Harian, Riwayat Tera); riwayat = tabel di laptop, kartu di HP.
- Form bongkaran 14 langkah dalam 3 fase (Bongkaran, Quality, Quantity) + Finish, setiap langkah ada foto wajib.
Warna status: hijau = sesuai, biru = aksi/aktif, cyan = menunggu, amber = pengingat, merah = anomali.
Warna produk: Pertalite hijau, Pertamax biru, Pertamax Turbo merah, Biosolar kuning, Pertamina Dex teal.
Aturan: target sentuh 44px, teks input 16px, kontras 4.5:1, angka pakai font monospace tabular,
format angka Indonesia (16.000 L; 0,7450), ringan untuk HP Android murah.
Buat layar: Dashboard, detail tanggal kalender, detail Kaleng Sample, Menu Input, Form bongkaran langkah 2,
Kualitas Harian, Menu Laporan, Riwayat Pembongkaran MT (HP & laptop).
```
