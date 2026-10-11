# FLOQ: Design Spec (untuk ganti desain UI)

> **FLOQ (Fuel Logistic Quality & Quantity)**: aplikasi evidence pembongkaran BBM, Q&Q harian, dan proteksi kebakaran (APAR & APAB) di SPBU.
> Dokumen ini menjelaskan **seluruh tampilan aplikasi saat ini**: token, komponen, setiap layar, dan aturan yang wajib dipertahankan.
> Pakai sebagai brief untuk desainer atau tool desain AI (Google Stitch, Figma AI, v0, dan lain-lain). Setelah desain baru jadi, ikuti **bagian 12** untuk memasangnya ke kode.

Versi: 8 Oktober 2026 · Stack: React 19 + Vite + Tailwind CSS v4 + Radix UI + lucide-react · Font: Inter

---

## Daftar isi

1. [Konteks pengguna](#1-konteks-pengguna)
2. [Yang boleh diganti dan yang wajib tetap](#2-yang-boleh-diganti-dan-yang-wajib-tetap)
3. [Brand](#3-brand)
4. [Token warna](#4-token-warna)
5. [Tipografi](#5-tipografi)
6. [Spasi, radius, permukaan, gerak](#6-spasi-radius-permukaan-gerak)
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
| Waktu pakai | Saat mobil tangki (MT) tiba, sepanjang shift (06:00-13:59, 14:00-21:59, 22:00-05:59), inspeksi APAR bulanan |
| Bahasa | Bahasa Indonesia, angka format Indonesia (`16.000 L`, `0,7450`) |
| Mode tampilan | Operasional (bukan pemasaran): cepat dibaca, jelas statusnya, tahan salah ketik |
| Data | Satu akun bisa dipakai di beberapa perangkat (HP & laptop); data tersinkron lewat server |

Pertanyaan yang harus dijawab tiap layar dalam 3 detik:
- **Dashboard**: kondisi mutu, penerimaan, dan proteksi kebakaran hari ini baik atau tidak?
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
- Semua field data, status, peringatan, validasi, dan konfirmasi keluar dari form.
- Target sentuh minimal **44 × 44 px**, teks input **16 px** (cegah zoom iOS).
- Kontras teks minimal **4,5 : 1** (teks kecil) di atas permukaan apa pun.
- Bottom sheet dan pop up berlatar **padat** (tidak tembus pandang).
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

| Token | Hex | Dipakai untuk |
|---|---|---|
| `background` / `surface` | `#F8F9FF` | Latar halaman (di atas gradasi kanvas) |
| `surface-container-lowest` | `#FFFFFF` | Kartu Dashboard, bottom sheet, isi tabel, label QR |
| `surface-container-low` | `#EFF4FF` | Kotak angka kecil, baris ringkasan, baris checklist |
| `surface-container` | `#E5EEFF` | Kotak SLA, tombol "soft" saat hover |
| `surface-container-high` | `#DCE9FF` | Lintasan progress bar, pill netral |
| `surface-container-highest` / `surface-variant` | `#D2E4FF` | Bulatan tanggal kalender, permukaan paling gelap |
| `on-surface` | `#0A1C30` | Teks utama |
| `on-surface-variant` | `#424656` | Teks sekunder, label |
| `outline` | `#727687` | Teks keterangan sangat sekunder, garis tegas |
| `outline-variant` | `#C2C6D8` | Pemisah tipis, garis putus-putus slot kosong |

Kanvas halaman: gradasi `radial(rgba(179,197,255,.35) di atas)` + `linear(#E9EFF6 → #DDE7F3)`.

### 4.2 Warna peran

| Peran | Token utama | Hex | Container / fixed | Makna |
|---|---|---|---|---|
| Primary (aksi) | `primary` | `#0050CB` | `primary-container #0066FF`, `primary-fixed #DAE1FF`, `on-primary-fixed #001849` | Tombol utama, tautan, tab aktif, hari ini di kalender |
| Secondary (info / menunggu) | `secondary` | `#006A64` | `secondary-fixed #65F8ED`, `on-secondary-fixed-variant #00504B` | Status menunggu, pill cyan (LO Planned / Alih Supply) |
| Tertiary (sesuai / beres) | `tertiary` | `#006645` | `tertiary-fixed #6FFBBE`, `on-tertiary-fixed-variant #005236` | Pill "Sesuai", "Segel sesuai", selisih aman, pill toleransi |
| Error (anomali) | `error` | `#BA1A1A` | `error-container #FFDAD6`, `on-error-container #93000A` | Anomali, wajib diisi, di bawah batas, temuan APAR, gagal |

Warna tambahan dari Tailwind:
- **amber** (`amber-50/300/500/700`): perlu perhatian, belum salah. Contoh: pengingat plan besok, titik plan di kalender, retensi kaleng 3, isi ulang APAR ≤ 30 hari, unit belum diperiksa bulan ini.
- **emerald** (`emerald-50/500/600/700`): kondisi baik di kotak ringkas (centang kalender, APAR baik, LO Closed).

### 4.3 Warna produk (identitas, bukan status)

Hanya untuk titik/garis produk, ikon produk, chip spesifikasi, bar Rencana vs Realisasi, dan isi ilustrasi kaleng. File: `src/lib/produk.ts` (`tile`, `chip`, `isi`, `garis`, `dot`, `teks`).

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
| UI | **Inter** (variable, `@fontsource-variable/inter`), mengikuti referensi stitch "Sistem Serba Bisa" | Semua teks |
| Angka | **Inter** dengan `tabular-nums` (kelas `tabular`) | Liter, density, jam, nopol, nomor SO/LO, kode APAR: digit sejajar per kolom |

Ganti font cukup di `src/index.css`: `@import` font dan variabel `--font-jakarta` (teks) serta `--font-numeric` (angka).

| Token | Ukuran / line-height | Berat | Untuk |
|---|---|---|---|
| `headline-xl` | 36 / 44 | 700 | Angka pahlawan di layar lebar |
| `headline-lg` | 28 / 36 | 600 | (cadangan) |
| `headline-md` | 20 / 26 | 600-700 | Judul header, judul bagian, judul kartu, kode unit APAR |
| `body-lg` | 16 / 24 | 400-700 | Nama produk, judul kartu tanda tangan |
| `body-md` | 14 / 20 | 400-700 | Teks utama |
| `body-sm` | 12 / 16 | 400-600 | Teks sekunder, isi tabel |
| `numeric-lg` | 24 / 30 | 600 | Total liter, angka di kotak ringkas |
| `numeric-md` | 16 / 22 | 500 | Angka di tile |
| `numeric-sm` | 12 / 16 | 500 | Angka kecil, tanggal di kalender |
| `tag` | 12 / 16 | 700, huruf besar, `+0.05em` | Label kecil, header tabel, pill |
| (mikro) | 10-11 px | 600-700, huruf besar | Label kotak di kartu Dashboard (mis. "DITERIMA") |

---

## 6. Spasi, radius, permukaan, gerak

**Spasi** (`space-*`): `2xs 4px` · `xs 6px` · `sm 8px` · `md 16px` · `lg 24px` · `xl 32px` · `2xl 48px` · margin halaman 16 px.

**Radius**: `sm 4px` · default `8px` · `md 12px` (kartu Dashboard, kotak, input) · `lg 16px` (kartu kaca) · `xl 24px` (bottom sheet) · `full` (pill, dock, chip, tombol bulat).

**Permukaan**

| Jenis | Latar | Dipakai |
|---|---|---|
| Kartu Dashboard | putih padat `surface-container-lowest` + `shadow-sm`, radius 12 | Semua kartu di Dashboard (gaya referensi stitch) |
| `glass-1` | putih 55%, blur 10 px (HP) | Kartu sekunder, chip, tombol bulat |
| `glass-2` | putih 72%, blur 14 px (HP) | Kartu utama halaman Input/Laporan, dock |
| `glass-3` | putih 88%, blur 18 px (HP) | Dropdown, toast |
| Bottom sheet | **putih padat**, tanpa blur | Semua pop up / sheet (supaya tidak tembus di Android) |
| `inset-field` | `rgba(235,242,250,.65)` + bayangan dalam | Kolom input, slot data |

Mode **Kurangi Transparansi** (pengaturan HP): semua kaca jadi warna padat `#F7F9FD` / `#FBFCFE` / `#FFFFFF`.

**Gerak**: masuk bertahap `fadeInUp` 0,5 s (`cubic-bezier(.16,1,.3,1)`, 5 tingkat jeda); tekan `scale(.95-.99)`; sheet geser dari bawah; titik shift berdenyut. Semua dimatikan saat **Kurangi Gerakan** aktif.

**Lapisan (z-index)**: header 40 · dock 50 · overlay sheet 60 · sheet 61 · dropdown 70 · toast 80.

**Cetak**: header, dock, dan latar orb disembunyikan (`print:hidden`); dipakai untuk label QR APAR.

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
- **Peran** (`src/lib/roles.ts`): dock, kartu menu Input/Laporan, dan isi Profil hanya menampilkan modul milik peran. Halaman di luar hak akses menampilkan kartu kunci "Halaman ini tidak tersedia untuk peran X" + tombol Ke beranda. Beranda: ABH/Pengawas = Dashboard, Kepala Shift = Input, Security = APAR & APAB.

| Peran | Dock | Kartu Input |
|---|---|---|
| ABH | Dashboard, Input, Laporan, Profil | semua |
| Pengawas | Dashboard, Input, Laporan, Profil | Stok awal, Input Bongkaran, Plan Pengiriman, Kualitas Harian, Uji Pasca Penerimaan, APAR (data utama & area, label QR) |
| Kepala Shift | Input, Laporan, Profil | Stok awal, Input Bongkaran, Plan Pengiriman, Kualitas Harian, APAR |
| Security | Input, Profil | APAR & APAB saja |
- **Konfirmasi keluar**: bila meninggalkan form bongkaran yang belum selesai atau Kualitas Harian dengan baris belum disimpan (lewat tombol kembali, dock, atau tautan), muncul sheet "Keluar dari form …?" dengan **Ya, keluar** (merah) dan **Tetap di sini**.
- **Dock**: 4 item, item aktif berlatar `primary/10` dan teks biru. Label 12 px huruf besar.
- **Bottom sheet**: semua form tambahan / ubah / detail muncul dari bawah (maks 88% tinggi layar, lebar maks 576 px), pegangan, judul + deskripsi + tombol tutup ×, footer tombol.
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
| | Edit SO & LO (halaman tabel, satu permintaan) | `/plan/so/:id` |
| | Kualitas Harian | `/kualitas` |
| | Uji Kualitas Pasca Penerimaan | `/sample` |
| | APAR & APAB (dashboard) | `/apar` |
| | Inspeksi APAR & APAB (pindai / kode) | `/apar/inspeksi` (`?terkirim=`) |
| | Inspeksi satu unit | `/apar/inspeksi/:id` |
| | Data utama APAR & APAB (daftar) | `/apar/data` |
| | Form unit APAR/APAB | `/apar/data/unit/:id` (`baru`) |
| | Label QR APAR & APAB | `/apar/label` (`?unit=`) |
| | Unit APAR/APAB (tujuan QR) | `/apar/unit/:id` |
| Laporan | Menu Laporan (kartu) | `/laporan` |
| | Catatan Persediaan BBM | `/laporan/persediaan` |
| | Berita Acara | `/laporan/ba` |
| | Riwayat Pembongkaran MT | `/laporan/bongkaran` |
| | Riwayat Tracking LO | `/laporan/lo` |
| | Riwayat Kualitas Harian | `/laporan/kualitas` |
| | Riwayat Tera | `/laporan/tera` |
| | Riwayat Inspeksi APAR | `/laporan/apar` |
| Profil | Profil, Kalkulator, Pengaturan SPBU, Anggota | `/profil`, `/kalkulator`, `/pengaturan`, `/anggota` |
| (tanpa dock) | Login | saat belum masuk |

---

## 8. Komponen

File di `src/components/ui/` (dasar), `src/components/bongkaran/` (khusus FLOQ), dan `src/components/apar/`.

| Komponen | File | Anatomi & varian | Status |
|---|---|---|---|
| **Button** | `ui/button.tsx` | Varian: `primary` (biru padat + bayangan), `glass`, `soft`, `ghost`, `danger`. Ukuran: `default` 44 px, `lg` 56 px, `sm`/`pill` 44 px bulat, `icon` 44 × 44 | disabled 50% opasitas, tekan scale .97 |
| **Input** | `ui/input.tsx` | Kotak `inset-field` 48 px, teks 16 px, satuan di kanan (`L`, `mm`, `°C`, `ml`, `L/mm`, `kg`) | fokus: latar putih + cincin biru |
| **Select** | `ui/select.tsx` | Pemicu seperti Input + chevron; daftar kaca `glass-3` | daftar selalu di atas sheet |
| **Choice** | `bongkaran/form-bits.tsx` | Segmented pill (Shift 1/2) di dalam `inset-field` | terpilih: putih + teks biru |
| **Field** | `form-bits.tsx` | Label `tag` + isi + hint kecil | |
| **Ladder** | `form-bits.tsx` | Daftar label-nilai di kotak inset + baris total tebal | |
| **CheckRow** | `form-bits.tsx` | Checkbox besar + teks konfirmasi | |
| **Pill** | `ui/pill.tsx` | Kapsul `tag` huruf besar + ikon opsional, satu baris. Nada: `neutral`, `primary`, `info`, `success`, `error`, `cyan` | |
| **GlassCard** | `ui/glass-card.tsx` | Kartu kaca level 1/2/3, radius 16 | |
| **Kartu (Dashboard)** | `pages/Dashboard.tsx` | Kartu putih padat: ikon biru + judul `headline-md` (+ subjudul) di kiri, aksi kecil di kanan, isi di bawah | |
| **Sheet** | `ui/sheet.tsx` | Bottom sheet padat: pegangan, judul, deskripsi, ×, isi gulir, footer | |
| **Toast** | `ui/toast.tsx` | Kaca, ikon + pesan | |
| **Tabs** | `ui/tabs.tsx` | Segmented dengan indikator geser (form: Bongkaran/Quality/Quantity/Finish) | |
| **SectionHeader** | `section-header.tsx` | Judul bagian `headline-md` + aksi kanan | |
| **StatTile** | `stat-tile.tsx` | Label tag + ikon + angka + hint | nada primary/error |
| **MenuCard** | `menu-card.tsx` | Kartu menu Input/Laporan: ikon biru 44 px, judul, satu kalimat, baris status (biru = beres, merah = perlu dikerjakan) + lencana angka merah | |
| **RecordTable** | `record-table.tsx` | Riwayat: judul huruf besar + chip "n dari total"; **HP = daftar kartu** (judul, baris keterangan, lencana kanan, chevron); **≥ md = tabel** (header tag, kolom BBM berupa chip, kolom Aksi) | baris bisa membuka halaman atau pop up |
| **ChipFilter** | `chip-filter.tsx` | Baris chip pilihan tunggal, bisa digeser | aktif: biru padat |
| **DateFilter** | `date-filter.tsx` | Chip Hari ini / 7 hari / Bulan ini / Semua / Pilih tanggal (+ 2 kolom tanggal). Di Plan & Tracking LO, tanggal kirim mendatang selalu ikut tampil | |
| **StatusBanner** | `status-banner.tsx` | Kotak status ikon + judul + detail; nada idle/success/error | |
| **StokGate** | `stok-gate.tsx` | Kartu merah "Stok awal Shift N belum diisi" + tombol "Isi stok awal" | |
| **PhotoSlot** | `photo-slot.tsx` | Label + pill Wajib/n foto + grid thumbnail (hapus ×) + tombol kamera besar garis putus-putus | memproses: spinner |
| **SignaturePad** | `signature-pad.tsx` | Kotak bergaris putus rasio 5:2 "Ketuk untuk tanda tangan" → **pop up** dengan kotak panduan bergaris, garis dasar ×, tombol Hapus/Batal & Simpan. Setelah simpan: gambar + lencana "Ulangi". Hasil dipotong mengikuti tinta | |
| **LeaveGuard** | `leave-guard.tsx` | Sheet konfirmasi keluar dari form | |
| **StepRail** | `pages/FormBongkar.tsx` | 14 bulatan nomor bisa digeser, pemisah antar fase, aktif biru besar | lengkap/terkunci |
| **Kaleng (ilustrasi)** | `kaleng-sample.tsx` | Kaleng: tutup, label `K1/K2/K3`, isi warna produk | |
| **lo-fields** | `lo-fields.tsx` | ErrorBox, ProdukSelect, SupplySelect yang dipakai bersama Plan, Edit SO & LO, dan langkah 2 bongkaran | |
| **KalengDetail** | `kaleng-detail.tsx` | Pop up detail uji kaleng (lihat 9.2) | |
| **UnitCard** | `apar/unit-cek.tsx` | Checklist satu unit APAR/APAB: kode + pill tipe, isi ulang, Semua butir baik, butir Baik/Tidak, catatan, foto | Hanya baca setelah dikirim |
| **QrImg** | `apar/qr.tsx` | Gambar QR (data URL) untuk alamat halaman unit | memuat: kotak berdenyut |
| **QrScanner** | `apar/qr.tsx` | Sheet kamera persegi + bingkai bidik putih; kolom "Atau ketik kode unit" + Buka | tanpa dukungan kamera: kotak penjelasan |
| **PlanReminder** | `shell/plan-reminder.tsx` | Tanpa tampilan: toast + notifikasi 06:00 | |

---

## 9. Layar per layar

Format tiap layar: **tujuan**, **isi berurutan**, **status khusus**.

### 9.1 Login
- Tengah layar: logo FLOQ, kartu kaca berisi **Email**, **Password**, tombol **Masuk**.
- Bawah layar: 3 lapis gelombang biru lembut (opasitas 0,14 / 0,20 / 0,28). Copyright di bawah kartu.
- Status: memuat, salah password (pesan merah), akun belum terdaftar sebagai anggota SPBU.

### 9.2 Dashboard (hanya data)
Semua kartu putih padat, ikon + judul di dalam kartu. Urutan **wajib**:

1. **Kartu operasional**: ikon kalender dalam bulatan biru muda, label "OPERASIONAL SPBU", tanggal ("Kamis, 8 Okt 2026"), pill shift berjalan dengan titik hijau berdenyut ("Shift 1 (06:00 - 13:59)").
2. **Status Bongkaran Pekan Ini** (Sen-Min), di kanan "W41 - Okt 2026" dengan panah pekan sebelum/berikut.
   - 7 kotak tinggi: label hari (SEN…MIN), tanggal 2 digit dalam bulatan, **titik oranye** di bawah bulatan = ada plan pengiriman, ikon status: centang hijau = sesuai, segitiga merah + kotak merah muda = anomali susut/D15, "—" = tidak ada data, "…" = hari ini masih berjalan.
   - Hari ini: kotak biru muda, bulatan biru padat. Hari mendatang tanpa plan: pudar.
   - Legenda: ● Plan pengiriman (oranye), ● Anomali susut/D15 (merah).
   - Ketuk tanggal → sheet: **Plan pengiriman** (produk, volume, shift, SO, LO, supply point, status), **Penerimaan** (bongkaran + Q&Q), **Kualitas** (D15 bongkar & uji harian), **Kuantitas** (tera bejana, stok awal per produk).
3. **Bongkaran Hari Ini** (judul jadi "Total Bongkaran" bila rentang bukan hari ini): pill rentang ("Hari ini" + ikon filter) yang membuka DateFilter.
   - 3 kotak: Diterima (+ "x dari y LO"), Transport loss (+ %), Discharge loss (+ %).
   - Daftar per produk (titik warna produk, nama, "n MT", Vol. diterima) yang **dapat dibuka (dropdown)**: MT, diterima, transport loss L & %, discharge loss L & %, dan daftar MT (nopol, LO, waktu, diterima, T/D) yang menuju form.
   - 2 kotak **SLA** ber-ikon (Req MS2 → selesai, Gate out → selesai).
4. **Rencana vs Realisasi** (plan hari ini, "Target n L"): per produk "x dari y LO dibongkar (z%)", bar dua lapis (padat = dibongkar, pudar = on delivery/delivered), "n L dibongkar (n L berjalan)" vs "n L target".
5. **Kualitas Harian (D15)**: pill toleransi; per produk kotak dengan garis warna produk, D15 acuan, D15 uji + selisih, pill Sesuai/Tidak sesuai/Belum.
6. **Kaleng Sample**:
   - Kartu kepala: ikon, judul, keterangan toleransi, **tombol ⓘ** (pop up ketentuan 4 poin), 4 kotak ringkas (Sampel sesuai, Ada anomali, Belum uji pasca penerimaan, Pembaruan).
   - Kartu akordeon per produk: ikon warna produk, nama + chip spesifikasi, nama tangki; kanan: D15 terkini (selisih), Bongkar terakhir, pill status, chevron.
   - Isi: label "Kiri terbaru, kanan terlama"; **3 kaleng** (HP: geser ke samping, kartu 85% lebar; layar lebar: 3 kolom).
     - **Kaleng 1** (terbaru): garis tepi tebal warna produk (merah bila anomali), lencana "Kaleng 1, terbaru" + "Segel sesuai", ilustrasi kaleng, **D15 sample mobil tangki (uji saat bongkar)** besar + selisih vs depot, lalu Waktu bongkar, No SO, No LO, Mobil tangki (nopol / komp.), tautan "Lihat detail uji".
     - **Kaleng 2-3**: versi ringkas; kaleng 3 menampilkan "Retensi: dibuang saat kaleng baru masuk" (amber).
     - **Slot kosong**: garis putus-putus, "Slot kaleng n kosong", tanggal plan kirim berikutnya.
   - **Pop up detail uji** (judul "Kaleng n Produk", status di atas):
     1. **Data DO Mobil Tangki**: Nomor SO, Nomor LO (tebal), Tanggal & waktu penerimaan (+ selesai bongkar), Supply point, Nopol, Driver (+ pengangkut), Tangki tujuan, tabel Kompartemen-Nomor segel.
     2. **Parameter Uji Density** (toleransi di kanan): blok *Sample mobil tangki per kompartemen (isi kaleng)*, *D15 dokumen depot*, *Uji kualitas pasca penerimaan (tangki pendam)*. Tiap blok: "Density observe: x g/ml", "Suhu: y °C", **kotak D15 disorot** di kanan (+ selisih vs depot). Lalu Air & sampel.
     3. **Data Retensi Kaleng Sampel**: posisi kaleng, masa simpan, kondisi segel, petugas uji pasca penerimaan.
     - Footer: Berita Acara, Tutup.
7. **LO Tracking**: 6 kotak status berwarna (Proses, OS, Planned, On Delivery, Delivered, Closed) + "Total n LO"; ketuk ke Riwayat Tracking LO.
8. **Proteksi Kebakaran** (bila ada unit APAR): strip jumlah unit (APAR terpasang | APAR cadangan | APAB), lalu 4 kotak (Baik, Ada temuan, Belum bulan ini, Isi ulang lewat) + "n unit"; ketuk ke dashboard APAR.

### 9.3 Menu Input
- **Bar wajib Stok Awal Shift** paling atas: merah "Isi stok awal Shift n" / netral "Stok awal Shift n terisi".
- Grid 2 kolom, 5 **MenuCard**: Input Bongkaran, Plan Pengiriman, Kualitas Harian, Uji Kualitas Pasca Penerimaan, **APAR & APAB**. Tiap kartu menampilkan status hidup, mis. "1 bongkaran belum selesai", "Plan besok belum dibuat", "Shift 1 belum diuji", "1 penerimaan belum diuji", "Bulan ini belum diinspeksi".

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
- Keluar sebelum selesai → konfirmasi (lihat bagian 7).

| # | Fase | Langkah | Isi utama |
|---|---|---|---|
| 1 | Bongkaran | Foto Mobil Tangki | Foto depan MT, **nopol** |
| 2 | | Dokumen LO & Data Bongkaran | Foto LO, pilih SO & LO dari Plan, tanggal/jam datang (shift otomatis), driver, pengangkut, Ship To, produk/SO/LO (otomatis), volume DO, density & suhu depot, D15 dokumen, gate out depot, kompartemen |
| 3 | | Buku Tera Mobil Tangki | Per kompartemen: **Tinggi T2 mobil tangki** (mm, penuh lebar), **Kapasitas** (L), **Kepekaan** (L/mm). Teks bantu: selisih liter = kepekaan × selisih mm (0,3 × −5 = −1,5 L) |
| 4 | | ATG Sebelum Pembongkaran | Tangki pendam; kartu **"Pembacaan berdasarkan ATG"** (tinggi/volume/suhu); totalisator awal nozzle |
| 5 | | Kelengkapan Safety | APAR, arde, atribut safety |
| 6 | | Segel Kompartemen | Kotak merah: cocokkan dengan dokumen LO fisik, foto, nomor segel per kompartemen, konfirmasi |
| 7 | | Deepstick Tangki Pendam (Sebelum) | Tinggi deepstick + volume |
| 8 | | Water Content Kompartemen MT | Nihil / Ada air (+ foto draining) |
| 9 | | Deepstick Kompartemen MT vs Buku Tera | Tinggi T2 (tetap) vs hasil deepstick; banner "Selisih −5 mm ≈ −1,5 L"; izin penanggung jawab bila selisih > batas |
| 10 | Quality | Sampel Minyak Kompartemen | Foto sampel atas & bawah |
| 11 | | Kualitas Density | Density & suhu per kompartemen → D15, selisih vs depot (anomali = berhenti) |
| 12 | Quantity | Hose & Fillport | Foto + konfirmasi |
| 13 | | ATG Setelah Pengisian | Jam selesai, jam baca ATG (≥ 10 menit), ATG setelah, totalisator akhir |
| 14 | | Dipping Manual Tangki Pendam (Sesudah) | Dipping + **tanda tangan pop up** penerima, security, supir (wajib); pengawas & ABH (bisa nanti) |

**Finish**: tangga perhitungan (stok awal, DO, stok teoritis, real stok, **Discharge gain/loss L & % volume DO**); transport loss + banner bila melewati batas; tombol unduh **Excel (template BA)**, **PDF BA saja** (cepat), **PDF + foto**, **JPG**; teks WhatsApp + Kirim WA; tanda tangan pengawas & ABH.
**Bongkaran selesai terkunci**: tidak bisa diubah atau dihapus; label "Bongkaran selesai, data terkunci". Buka kembali hanya untuk BA anomali oleh pengawas.

### 9.6 Plan Pengiriman
- Banner amber (≥ 06:00 bila plan besok belum ada): "Plan pengiriman besok belum dibuat" + Buat plan besok + Aktifkan notifikasi.
- Tombol besar **Permintaan baru (MS2)** → sheet: Tanggal kirim, Supply point, Tanggal & jam MS2, Ship To, PO SAP (opsional); **baris produk**: Produk, Volume L, hapus, **Shift 1/2 per produk (wajib)**; Tambah produk; Simpan (terkunci saat menyimpan).
- Kartu **Status SO & LO**: DateFilter + 8 kotak status (bisa jadi saringan).
- **Tabel Plan Pengiriman** (RecordTable, satu baris per LO): Tgl kirim, No SO, No LO (LO lama dicoret → LO baru bila alih supply), Produk, Volume, Shift, Supply point, Permintaan MS2, Status. Plan bertanggal kirim mendatang selalu tampil.
- Form permintaan MS2: volume per produk dipecah otomatis, **tiap 8.000 L = 1 LO** (16.000 L → 2 LO; 20.000 L → 8.000 + 8.000 + 4.000). Pratinjau "= n LO" tampil di bawah tiap produk.
- Ketuk baris → halaman **Edit SO & LO** (`/plan/so/:id?lo=<id>`, bukan pop up):
  - Kartu atas: data permintaan MS2 (hanya dibaca: supply point, Ship To, waktu MS2, total LO & liter) + field **Nomor SO**.
  - Tabel **Daftar LO**, kolom: No (+ tombol hapus untuk pengawas), Produk / Volume (maks. 8.000 L) / Shift, Nomor LO / Status. Di HP isian bertumpuk dalam sel; di layar lebar berjajar sesuai judul kolom. Baris yang diketuk ditandai garis biru dan digulir ke tengah.
  - LO Delivered/Closed: baris terkunci (ikon kunci, nomor, "dari LO lama", nopol MT, pill status).
  - Status **Alih Supply** membuka baris tambahan: nomor LO baru + supply point baru.
  - LO lama di atas 8.000 L dipecah otomatis menjadi beberapa baris (latar kuning + catatan).
  - Tombol **Batal** dan **Simpan & kembali**; simpan otomatis kembali ke Tracking LO asal (`/plan` atau `?dari=/laporan/lo`). Keluar dengan perubahan belum disimpan memunculkan konfirmasi.

### 9.7 Kualitas Harian
- Kartu kepala: "Uji Q&Q Shift n", tanggal, pill Selesai/Sebagian tersimpan/Belum diuji, jam uji, shift, petugas.
- **Uji kualitas (density)**: kartu per produk: Produk, Density, Suhu, Pump test, tangga (density observasi, D15, acuan D15 bongkaran, selisih), baris status + **tombol Simpan per baris** ("Tersimpan jam" / "Belum disimpan"). Uji produk lain.
  - **Langkah terakhir**: PhotoSlot wajib *Foto struk pump test* & *Foto pengembalian minyak ke tangki*.
- **Tera takaran (bejana 20 L)**: baris per nozzle: Selisih bejana (ml), Pump test (L), **Simpan per nozzle**, merah bila < −60 ml. Langkah terakhir: 2 foto yang sama.
- Ringkasan pump test + tombol **Selesaikan uji** (ditolak bila ada baris belum disimpan / foto belum ada). Riwayat + DateFilter.

### 9.8 Uji Kualitas Pasca Penerimaan
- Penjelasan singkat (**wajib** setiap penerimaan, jam uji diatur petugas). **Belum diuji**: baris bongkaran (produk, nopol, tanggal, selesai bongkar, pill "Wajib diuji" merah).
- Ketuk → sheet: tanggal & jam uji (harus setelah bongkar selesai), density, suhu, tangga (D15 tangki, D15 depot, D15 saat bongkar, selisih), petugas, catatan, Simpan uji.
- **Sudah diuji**: daftar hasil + pill Sesuai/Tidak sesuai.

### 9.9 APAR & APAB
- **Dashboard** (`/apar`):
  - Kartu kepala: ikon pemadam merah, "Proteksi Kebakaran", jumlah pulau/APAR/cadangan/APAB; tombol **Mulai / Lanjutkan inspeksi (x/n) / Lihat inspeksi hari ini**, **Pindai QR**, **Label QR**, **Data utama**.
  - 3 kartu jumlah (APAR terpasang, APAR cadangan, APAB), lalu 5 kotak: Kondisi baik (x/n, hijau), Ada temuan (merah bila > 0), Belum bulan ini (amber), Isi ulang (lewat / ≤ 30 hari), **Uji instansi (12 bln)** (merah bila ada yang lewat, amber bila ≤ 30 hari/belum dicatat; selebar 2 kolom di HP). Chip saring tambahan **Uji instansi**; baris unit menampilkan "Uji instansi s/d …" bila lewat/≤ 30 hari.
  - **Per area**: ikon pin, nama area, kode unit, pill Baik / n temuan / n belum.
  - **Daftar unit** + chip saring (Semua, Temuan, Belum bulan ini, Isi ulang): kode, tipe, lokasi, tanggal diperiksa, peringatan isi ulang, pill status, chevron → halaman unit.
- **Inspeksi** (`/apar/inspeksi`), per unit di lokasi, tanpa inspeksi massal:
  - Banner hijau setelah kirim: "Inspeksi APAR-01 terkirim (baik/ada temuan). Lanjutkan ke unit berikutnya: n unit belum".
  - Kartu kepala: ikon pemadam, "Inspeksi per unit di lokasi" + petunjuk; tombol utama **Pindai QR unit**; field "Label QR rusak? Ketik kode unit" + **Buka** (kode salah: pesan merah).
  - **Bulan ini: x dari n unit** + bar progres; chip Belum / Sudah / Semua; baris unit (kode, tipe, lokasi, tanggal & petugas) dengan pill Belum / Baik / Temuan. Baris tidak membuka form: inspeksi hanya dari QR atau kode.
- **Inspeksi satu unit** (`/apar/inspeksi/:id`): kartu unit (kode besar, pill tipe, jenis, kapasitas, lokasi, isi ulang), tombol **Semua butir baik**, butir **Baik / Tidak**, catatan (wajib bila temuan), **foto wajib**; kartu bawah: Petugas, Tanggal (hari ini), **Kirim inspeksi APAR-01** → kembali ke pemindai. Unit yang sudah dikirim hari ini: ringkasan + **Koreksi inspeksi hari ini**. Keluar sebelum kirim memunculkan konfirmasi.
- **Data utama** (`/apar/data`, ubah oleh ABH & Pengawas; jumlah pulau hanya ABH di Pengaturan): 4 kotak ringkas (pulau pompa, APAR terpasang, cadangan, APAB); tombol **Tambah APAR / APAB**, Label QR, Jumlah pulau (ke Pengaturan), "Tambah 1 APAR di n pulau yang belum punya"; **Unit tersimpan** (chip saring + RecordTable: kode, tipe, jenis & kapasitas, lokasi, isi ulang, pill isi ulang lewat/≤ 30 hari) — ketuk baris membuka form; **Area / lokasi** (pulau otomatis dari jumlah pulau, area lain + hapus bila kosong; "Tambah area" membuka bottom sheet).
- **Form unit** (`/apar/data/unit/:id`): tipe (APAR / APAB, hanya unit baru; kode & kapasitas awal ikut tipe), kode (unik), kapasitas, jenis media, lokasi, jadwal isi ulang, **Pemeriksaan instansi terakhir** (tanggal, hint "Berlaku sampai …(maks. 12 bulan)") + **Instansi pemeriksa**, centang cadangan; **Batal / Simpan unit**; unit lama: Kondisi unit, Label QR, Hapus unit.
- **Label QR** (`/apar/label`): chip saring (Semua/APAR/APAB), tombol **Cetak / simpan PDF (n label)**; label putih berbingkai hitam: pita merah di atas berisi ikon pemadam + nama SPBU utuh (boleh 2 baris), lalu QR 100 px + kode 22 px tebal, tipe (kotak bergaris), jenis & kapasitas, lokasi. Warna dicetak (print-color-adjust: exact). Saat cetak: 3 kolom.
- **Unit** (`/apar/unit/:id`, tujuan QR): QR + kode besar, tipe, jenis/kapasitas, lokasi; chip isi ulang; tombol **Inspeksi unit ini**, Cetak label, Data utama; **Kondisi terakhir** (tanggal, petugas, temuan merah, catatan, foto); **Kalender kepatuhan inspeksi** (pemilih tahun, 12 kotak bulan 4/6 kolom: hijau ✓ baik, merah ⚠ temuan, merah putus-putus × terlewat, amber • bulan ini, abu bulan mendatang/sebelum terdaftar; ketuk bulan untuk detail; "Kepatuhan YYYY: x dari n bulan (%)"; catatan amber "Periksa setiap 30 hari…"); **Riwayat inspeksi**. Unit terhapus: "Unit tidak ditemukan".
- **Pindai QR**: sheet kamera belakang (bingkai bidik + garis pindai bergerak, "Arahkan label QR ke dalam kotak", tombol senter bila didukung, getar saat terbaca). Dekoder: BarcodeDetector bila ada, jsQR untuk iPhone & browser lain. Kamera gagal: ikon kamera dicoret + pesan penyebab (izin ditolak / tidak ada kamera / dipakai aplikasi lain / bukan https) + **Coba lagi**. Cadangan: **Kamera tidak jalan? Ambil foto label** (foto dibaca jsQR) dan "Label rusak? Ketik kode unit". QR berisi kode unit saja juga dikenali.

### 9.9b Pelaporan Insiden, Near miss & Kerusakan
- **Form** (`/insiden/baru`, semua peran): 3 kartu jenis (Insiden / Near miss / Kerusakan, kartu terpilih biru), Kategori (Select per jenis), Tanggal & Jam kejadian, Lokasi (pulau + area APAR + Area lain), Peralatan (datalist dispenser/nozzle), Uraian, Dampak/korban (wajib untuk insiden), Dugaan penyebab, Tindakan yang sudah dilakukan, Tingkat risiko (Rendah/Sedang/Tinggi), Foto (wajib untuk insiden & kerusakan), Pelapor; tombol **Kirim laporan …** → Riwayat Insiden dengan banner hijau dan baris biru.
- **Riwayat** (`/laporan/insiden`): kartu "n laporan belum selesai" + tombol Laporkan, DateFilter, chip Jenis & Status; RecordTable (Tanggal, Jenis, Kategori, Lokasi, Risiko, Pelapor, Status); baris terbuka oranye.
- **Detail** (`/laporan/insiden/:id`): kartu ringkas (jenis, kategori, waktu, lokasi, risiko, status), uraian/dampak/penyebab/tindakan/pelapor/PIC, foto 96 px; **Tindak lanjut** (linimasa terbaru di atas); form **Tambah tindak lanjut** (status, PIC, target selesai, catatan) untuk ABH/Pengawas/Kashift.

### 9.10 Menu Laporan
Grid 2 kolom (3 di layar lebar), 7 MenuCard: Catatan Persediaan BBM, Berita Acara (merah bila menunggu tanda tangan), Riwayat Pembongkaran MT, Riwayat Tracking LO, Riwayat Kualitas Harian, Riwayat Tera (merah bila ada nozzle di bawah batas), Riwayat Inspeksi APAR (merah bila ada unit dengan temuan).

### 9.11 Halaman laporan (semua memakai RecordTable)

Aturan umum: setelah **submit**, aplikasi pindah ke riwayatnya (stok → Catatan Persediaan, kualitas harian & pasca penerimaan → Riwayat Kualitas Harian, bongkaran selesai → Riwayat Pembongkaran dengan tombol "Laporan WA & unduh BA", insiden → Riwayat Insiden, MS2 / Edit SO & LO → Tracking LO, unit APAR → Data utama). Data baru: banner hijau + baris biru (`BARIS_BARU`); perlu perhatian (SO/LO belum terbit, insiden terbuka, tera lewat): baris oranye (`BARIS_ORANYE`).

| Halaman | Penyaring | Kolom (urut) |
|---|---|---|
| **Catatan Persediaan BBM** | Produk (Select), DateFilter | Pratinjau: Tanggal, Shift, Stok awal, Terima, Keluar, Selisih; tombol **Unduh Excel / PDF** (format template asli) |
| **Berita Acara** | DateFilter, 4 kotak status (Semua/Selesai/Anomali/Draft) | BBM, Nopol, Tanggal/Jam, No BA, Volume, Tanda tangan ("Menunggu Pengawas, ABH"), Status |
| **Riwayat Pembongkaran MT** | DateFilter, chip produk | **Produk, Tgl penerimaan, No SO, No LO, Nopol & supir**, Volume, Transport loss, Discharge loss (L & %), SLA (Req / Gate out), Keterangan (pill), Status, Progress tindakan |
| **Riwayat Tracking LO** | DateFilter, chip status (dengan jumlah) | **Tgl permintaan kirim, No SO, No LO, Produk, Volume, Supply point, Nopol MT, Status** (Closed dengan ikon kunci). Ketuk baris → halaman **Edit SO & LO**, simpan kembali ke Riwayat Tracking LO |
| **Riwayat Kualitas Harian** | DateFilter, chip jenis (Uji harian / Uji pasca penerimaan), chip produk | Tanggal, Waktu, Jenis, BBM, Density, Suhu, D15, Acuan, Selisih, Status |
| **Riwayat Tera** | DateFilter, chip Semua / Di bawah batas | Tanggal, Shift, Nozzle, BBM, Selisih (ml), Pump test, Status |
| **Riwayat Inspeksi APAR** | DateFilter, chip Semua / Ada temuan | Tanggal, Kode, Tipe, Jenis & kapasitas, Lokasi, Temuan, Tindak lanjut, Petugas, Hasil. Ketuk baris → halaman unit (data & riwayat) |

### 9.12 Profil, Kalkulator, Pengaturan, Anggota
- **Tanda tangan**: tombol "Ketuk untuk tanda tangan" membuka **layar penuh** (area gambar sebesar layar, kotak panduan, putar HP untuk area lebar); **Simpan tanda tangan** → pratinjau "Gunakan tanda tangan ini?" dengan **Ulangi / Ya, simpan**. Tanda tangan tersimpan tampil ringkas (gambar 48 px + Ulangi).
- **Dashboard**: kartu Kualitas Harian bisa diketuk → pop up highlight uji terakhir produk itu; banner amber bila sertifikat tera nozzle lewat / ≤ 30 hari.
- **Profil**: kartu identitas (inisial, nama, pill peran, email, SPBU), 3 StatTile (bila punya bongkaran), grup **Alat bantu** (Kalkulator), grup **Akun & SPBU** (ABH: Pengaturan SPBU, Anggota & akun per peran, Data utama APAR & APAB, Data acuan; semua: **Ganti kata sandi** (bottom sheet), Keluar).
- **Kalkulator**: Density observasi + Suhu → D15 (angka besar); Tangki + Ketinggian → volume dari tabel kalibrasi.
- **Pengaturan SPBU** (ABH) kini menu daftar ke halaman terpisah: Identitas SPBU, Data Dispenser (RecordTable + sheet form: unit, merk, nomor seri, pulau), Nozzle & Tera Metrologi (RecordTable: nozzle, produk, dispenser, no. sertifikat, tanggal tera, berlaku s/d, pill Tera lewat / ≤ 30 hari / Belum dicatat / Berlaku; baris oranye bila lewat/≤ 30 hari; sheet form dengan hint "Berlaku sampai …"), Sold To & Ship To (ABH & Pengawas), Data utama APAR, Aturan Pemeriksaan, Data Acuan. Isi lama (referensi): Nama SPBU, Kode, Alamat, logo; **Jumlah pulau pompa** & **Jumlah dispenser** (+ jumlah nozzle); nama default (Petugas penerima, Pengawas, Security, ABH, Perusahaan pengangkut); **Nozzle Dispenser**; **Proteksi Kebakaran** (ringkasan + tautan ke Data utama APAR & APAB); Aturan (Toleransi density 15°C, Batas kurang vs tera, Tunggu sebelum baca ATG, Liter per 1 DO, PIN penanggung jawab); Data acuan tabel.
- **Anggota** (ABH, mode server): kartu **Buat akun baru** (Nama, Peran, Email, Kata sandi sementara + tombol acak, keterangan hak akses peran, tombol **Buat akun <peran>**, kotak hijau email & sandi yang dibuat); daftar anggota (nama/email, Select peran, ikon kunci = atur ulang kata sandi lewat bottom sheet, hapus); **Hak akses per peran**; lipatan "Daftarkan akun yang sudah ada".


### 9.12b Uji Takaran (bejana 20 L)
- **Input > Uji Takaran** (`/takaran`): kartu kepala (ikon gelas ukur, "Uji takaran nozzle", toleransi -60 ml); Nomor nozzle & Produk (input teks + datalist); 2 tombol radio besar **P · Preset** / **M · Manual** (centang bila nozzle itu sudah diuji hari ini); Hasil (ml, sufiks ml); kotak status langsung "Nozzle 3 Pertalite, Preset = -40 ml" hijau (dalam toleransi) / merah (melebihi toleransi -60 ml). Kartu foto: **Dudukan bejana & water pass** dan **Hasil pengukuran**, masing-masing grid 3 kolom pratinjau + tombol "Ambil foto" (pill Belum / n foto); keterangan "Tanggal, jam, SPBU, nozzle, dan opsi tercetak otomatis pada foto"; Petugas, Catatan; tombol **Kirim hasil Nozzle n · Preset/Manual**. Daftar **Hasil uji hari ini (n)** bernomor, baris terbaru biru, melebihi toleransi oranye; ketuk → pop up detail (angka besar, pill, foto utuh, Hapus). Keluar saat ada isian → sheet "Keluar dari uji takaran?".
- **Cap foto**: pita gelap di bawah foto; baris 1 kuning tebal "dd/mm/yyyy hh:mm:ss WIB", baris 2 "SPBU · Nozzle n Produk", baris 3 "Uji takaran 20 L · opsi · jenis foto".
- **Laporan > Riwayat Uji Takaran**: DateFilter, chip Semua / Melebihi toleransi / Sesuai, RecordTable (Tanggal, Nozzle, Produk, Opsi, Hasil, Petugas, Status), baris oranye bila melebihi toleransi.

### 9.13 Multi SPBU: Unit Bisnis, Siapkan SPBU, Database Tangki
- **Pemilih SPBU** (ABH): nama SPBU di bawah judul header + chevron; ketuk → bottom sheet "Pilih SPBU" (cari bila > 6 unit, baris ikon gedung + nama + kode, centang SPBU aktif) dan tombol **Dashboard unit bisnis & tambah SPBU**. Peran lain: nama SPBU biasa.
- **Unit Bisnis** (`/unit`, ABH; kartu "Unit bisnis: n SPBU" di atas Dashboard): kartu kepala (ikon gedung, "n unit bisnis", Sinkronkan, **Tambah SPBU**); 4 StatTile (Data siap x/n, Q&Q hari ini x/n, Bongkaran bulan ini + anomali, Insiden terbuka); cari + chip saring (Semua, Perlu perhatian, Belum siap, Siap); RecordTable **Unit bisnis**: SPBU (nama + kode), Data SPBU (pill Siap / Belum diisi / Identitas kurang / Tangki kosong), Q&Q 7 hari (7 kotak: hijau 3 shift, kuning sebagian, abu belum), Bongkar (bln) + anomali merah, APAR (bln) x/n, Insiden, Pengawas / akun, Terakhir aktif. Baris oranye = perlu perhatian. Ketuk baris → SPBU aktif berganti, buka Dashboard. Sheet **Tambah SPBU**: nama, kode.
- **Siapkan Data SPBU** (`/siapkan`, wajib untuk pengawas & ABH bila identitas atau tangki kosong; tanpa tombol kembali): kartu "Lengkapi data SPBU dulu" + 2 langkah (amber = belum, hijau ✓ = lengkap); 1. Identitas (nama, kode, alamat, jumlah pulau pompa, jumlah dispenser); 2. Database tangki (daftar + **Tambah tangki**); tombol **Data lengkap, mulai pakai FLOQ** aktif bila keduanya lengkap. Kepala shift & security: kartu "Data SPBU belum lengkap" + Periksa lagi + Keluar.
- **Database Tangki** (`/pengaturan/tangki`, ABH & pengawas): baris per tangki (ikon tabung warna produk, "Tangki n Produk", kapasitas, rentang mm, jumlah baris, tanggal kalibrasi, pill OK / n titik janggal). **Form tangki**: Produk, Nomor tangki, Tanggal kalibrasi; kartu **Tabel kalibrasi** (petunjuk salin dari Excel, pilihan satuan mm / cm, kotak tempel monospace, Pilih file CSV); pratinjau "Terbaca: n baris, tinggi a–b mm, kapasitas c L", peringatan merah titik volume turun, isian **Uji: tinggi (mm)** → volume; Catatan; Batal / Simpan tangki; Hapus tangki.

---

## 10. Status & makna warna

| Makna | Warna / nada | Contoh |
|---|---|---|
| Sesuai / beres / tersimpan | tertiary / emerald (hijau) `success` | Sesuai, Segel sesuai, Lolos uji, APAR Baik |
| Aksi / info utama / aktif | primary (biru) | Tab aktif, tautan, hari ini, progress |
| Menunggu (bukan salah) | secondary (cyan) | LO Planned / Alih supply, D15 belum ada |
| Perlu perhatian (pengingat) | amber | Plan besok belum dibuat, kaleng akan dibuang, isi ulang ≤ 30 hari, belum diperiksa bulan ini |
| Anomali / wajib / gagal | error (merah) | Anomali density, di bawah batas tera, Wajib diisi, Tidak sesuai, temuan APAR, isi ulang lewat |
| Netral / belum ada | neutral (abu) | Belum ada sampel, Draft, LO Proses, unit Belum diperiksa |

**Status LO** (label & nada): Proses (neutral), OS (info), Planned (cyan), On Delivery (primary), Alih Supply (cyan), Deleted (error), Delivered (primary), Closed (success, terkunci).

Aturan: status **tidak pernah hanya warna**. Selalu ada teks dan, bila penting, ikon.

---

## 11. Aturan konten, aksesibilitas, HP spesifikasi rendah

**Konten**
- Bahasa Indonesia baku-santai, kalimat pendek. Tanpa em-dash (`—`); pakai koma atau titik dua.
- Angka: ribuan titik, desimal koma (`16.000 L`, `0,7450`, `+0,07%`). Density 4 desimal. Satuan selalu tampil.
- Tanggal: `8 Okt 2026`; panjang: `Kamis, 8 Oktober 2026`. Jam 24 jam `HH:MM`.

**Aksesibilitas**
- Target sentuh ≥ 44 px; teks input 16 px; fokus terlihat (garis biru 2 px).
- Kontras teks ≥ 4,5 : 1; teks di atas kaca harus tetap terbaca di bawah sinar matahari.
- Semua ikon tanpa teks punya `aria-label`; tabel punya header; meter punya nilai; pilihan Baik/Tidak berupa radiogroup.

**HP spesifikasi rendah**
- Blur kaca dikurangi di layar sentuh (10/14/18 px); bottom sheet tanpa blur. Orb latar diam, tanpa animasi.
- Halaman selain Dashboard & menu Input dimuat saat dibuka (lazy). Foto dikompres (maks 1280 px, JPEG 0,72) sebelum diunggah.
- Data dari perangkat lain dimuat ulang saat aplikasi tampil lagi, saat online, saat halaman terkait dibuka, dan tiap 60 detik.
- Hindari: video latar, animasi terus-menerus, bayangan berlapis banyak, gambar besar dekoratif.

---

## 12. Cara memasang desain baru ke kode

| Yang diganti | File |
|---|---|
| Warna, font, ukuran teks, spasi, radius, efek kaca, sheet, gerak | `src/index.css` (blok `:root`, `@theme inline`, `@utility glass-*`, `.sheet-content`, `@media`) |
| Font | `package.json` (`@fontsource-variable/*`) + `@import` di atas `src/index.css` |
| Tombol, input, select, pill, kartu, sheet, toast, tab | `src/components/ui/*.tsx` |
| Header, dock, latar orb | `src/components/shell/*.tsx` |
| Kartu menu, tabel riwayat, filter, slot foto, kaleng, tanda tangan | `src/components/bongkaran/*.tsx` |
| QR & pemindai APAR | `src/components/apar/qr.tsx` |
| Isi & urutan layar (termasuk kartu Dashboard) | `src/pages/*.tsx` |
| Nama menu, judul halaman, rute | `src/lib/nav.ts`, `src/App.tsx` |
| Warna produk | `src/lib/produk.ts` |
| Logo & ikon | `public/` |

Langkah aman:
1. Ganti nilai token di `src/index.css` dulu (sebagian besar perubahan tampilan cukup di sini, karena komponen memakai nama peran: `bg-primary`, `text-on-surface`, `glass-2`, dll.).
2. Baru ubah bentuk komponen di `src/components/ui/`.
3. Jalankan `npm run dev` lalu cek di lebar 360 px dan 1280 px; `npm run build` dan `npm run lint` harus lulus.
4. Jangan ubah nama token yang sudah dipakai; tambah token baru bila perlu.

---

## 13. Prompt siap pakai untuk tool desain AI

Salin, lalu ganti bagian `[GAYA BARU]`:

```
Redesign aplikasi mobile web "FLOQ" (Fuel Logistic Quality & Quantity) untuk petugas SPBU Pertamina.
Bahasa Indonesia. Layar utama HP 390 px, juga layar laptop 1280 px. Font Inter, angka tabular.

Gaya baru: [GAYA BARU, mis. "material modern, kartu putih solid, aksen biru Pertamina #0050CB,
kontras tinggi untuk di bawah sinar matahari, sudut 12px, tanpa efek kaca"].

Pertahankan struktur:
- Dock bawah 4 menu: Dashboard, Input, Laporan, Profil. Header atas: logo / tombol kembali, judul, nama SPBU, inisial user.
- Dashboard (hanya data, tanpa tombol input), urutan:
  1) kartu operasional (tanggal + pill shift berjalan);
  2) Status Bongkaran Pekan Ini (7 kotak hari: ikon status centang/segitiga/strip/titik tiga, titik oranye = plan kirim, ketuk = detail);
  3) Bongkaran Hari Ini (diterima, transport loss, discharge loss L & %, daftar produk dropdown, SLA request MS2 & gate out);
  4) Rencana vs Realisasi per produk (bar dua lapis);
  5) Kualitas Harian (D15) per produk;
  6) Kaleng Sample (kartu per produk, 3 kaleng kiri terbaru kanan terlama, D15 sample mobil tangki vs D15 depot,
     waktu bongkar, No SO, No LO, mobil tangki; slot kosong; pop up detail uji);
  7) LO Tracking (6 status berwarna);
  8) Proteksi Kebakaran (jumlah APAR terpasang/cadangan/APAB, APAR baik, ada temuan, belum bulan ini, isi ulang lewat).
- Menu Input: bar wajib Stok Awal Shift + 5 kartu (Input Bongkaran, Plan Pengiriman, Kualitas Harian,
  Uji Kualitas Pasca Penerimaan, APAR & APAB) dengan status hidup dan lencana merah bila perlu dikerjakan.
- Menu Laporan: 7 kartu (Catatan Persediaan BBM, Berita Acara, Riwayat Pembongkaran MT, Riwayat Tracking LO,
  Riwayat Kualitas Harian, Riwayat Tera, Riwayat Inspeksi APAR); riwayat = tabel di laptop, kartu di HP.
- Form bongkaran 14 langkah dalam 3 fase (Bongkaran, Quality, Quantity) + Finish, setiap langkah ada foto wajib;
  buku tera: Tinggi T2, Kapasitas, Kepekaan (L/mm); tanda tangan lewat pop up dengan kotak panduan.
- Plan Pengiriman: tabel LO (tgl kirim, SO, LO, produk, volume, shift, supply point, MS2, status); halaman Edit SO & LO berbentuk tabel (Nomor SO lalu Nomor LO & status tiap LO, tanpa segel, maks. 8.000 L per LO), simpan kembali ke Tracking LO. Langkah 2 bongkaran: tombol "Ubah nomor LO / pindah station" pada LO terpilih (bottom sheet: nomor LO baru, centang pindah station + supply point baru); tersimpan ke Plan sehingga Tracking LO ikut berubah.
- APAR & APAB: dashboard (ringkas kondisi, per area, daftar unit), inspeksi per unit (butir Baik/Tidak + foto wajib),
  data utama (pulau, area, unit), label QR siap cetak, halaman unit dari QR (data, kondisi terakhir, riwayat).
Warna status: hijau = sesuai, biru = aksi/aktif, cyan = menunggu, amber = pengingat, merah = anomali.
Warna produk: Pertalite hijau, Pertamax biru, Pertamax Turbo merah, Biosolar kuning, Pertamina Dex teal.
Aturan: target sentuh 44px, teks input 16px, kontras 4.5:1, pop up berlatar padat, format angka Indonesia
(16.000 L; 0,7450), ringan untuk HP Android murah.
Buat layar: Dashboard, detail tanggal kalender, detail Kaleng Sample, Menu Input, Form bongkaran langkah 3,
Plan Pengiriman, Kualitas Harian, Dashboard APAR, Inspeksi APAR, Label QR, Menu Laporan,
Riwayat Pembongkaran MT (HP & laptop).
```
