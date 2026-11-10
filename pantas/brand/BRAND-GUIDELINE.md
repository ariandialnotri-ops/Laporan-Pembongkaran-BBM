# PANTAS — Brand Identity Guideline

**PANTAS** · *Pemantauan Anomali Penyaluran BBM Subsidi*
Versi 1.0 · Dokumen kerja internal

---

## 1. Fondasi Merek

### Nama
**PANTAS** — akronim dari **P**emantauan **AN**omali **T**ransaksi & **A**liran **S**ubsidi.

Dibaca sebagai satu kata Indonesia yang sudah dikenal ("pantas" = patut, layak, sesuai) dan berakar pada "pantau". Dua makna itu menjadi inti merek: **memastikan penyaluran berjalan sebagaimana mestinya.**

### Tagline
> **Penyaluran yang pantas, tercatat, terawasi.**

Tagline pendek untuk UI dan ikon: *Pemantauan Anomali Penyaluran BBM Subsidi*

### Positioning
PANTAS adalah sistem pemantauan yang membaca data pembongkaran dan penyaluran BBM subsidi, lalu menandai transaksi yang menyimpang dari pola wajar — selisih volume, kuota terlampaui, pengisian berulang, waktu janggal — sebelum penyimpangan menjadi kerugian.

### Kepribadian merek
| Adalah | Bukan |
|---|---|
| Tegas dan faktual | Menuduh atau dramatis |
| Tenang, siap siaga | Ramai dengan alarm |
| Presisi (angka, jejak audit) | Perkiraan kasar |
| Resmi, layak dibawa ke rapat | Kaku dan birokratis |

### Nada komunikasi
Bahasa Indonesia formal-operasional. Kalimat aktif, singkat, berbasis angka.
Contoh notifikasi: *"Selisih 412 L (2,8%) pada pembongkaran SPBU 34.xxx.xx — di atas ambang 1,5%."*
Bukan: *"Waduh, ada yang tidak beres di SPBU ini!"*

---

## 2. Logo

### Konsep
Lambang PANTAS adalah **perisai aliran**:

- **Perisai** — pengawasan dan perlindungan kuota subsidi agar tepat sasaran.
- **Garis aliran putih** — penyaluran BBM yang berjalan normal.
- **Lonjakan merah bertitik** — anomali yang terdeteksi; satu-satunya elemen merah dalam lambang, sehingga mata langsung tertuju ke sana. Ini merepresentasikan fungsi inti produk.
- **Gradasi biru ke hijau** — mengikuti bahasa warna korporat Pertamina (biru–hijau–merah) tanpa meniru bentuk logo panah Pertamina.

Garis aliran disusun simetris terhadap sumbu tengah perisai: ruas normal di kiri, lonjakan tepat di tengah, ruas normal di kanan dengan panjang yang sama. Keseimbangan ini menjaga lambang tetap stabil saat diperkecil.

### Varian berkas

| Berkas | Penggunaan |
|---|---|
| `logo/pantas-logo-horizontal.svg` | Utama. Header aplikasi, kop laporan, dokumen. |
| `logo/pantas-logo-stacked.svg` | Ruang sempit vertikal: layar login, splash screen, spanduk. |
| `logo/pantas-logo-horizontal-inverse.svg` | Latar gelap (mode malam, ruang kendali). |
| `logo/pantas-mark.svg` | Lambang tanpa teks: avatar, watermark, sidebar terlipat. |
| `logo/pantas-mark-mono.svg` | Satu warna, mengikuti `currentColor`. Untuk cetak hitam-putih, stempel, faks, bordir. |
| `logo/pantas-wordmark.svg` | Wordmark tanpa lambang, mengikuti `currentColor`. Untuk watermark dokumen dan kop sederhana. |
| `logo/favicon/pantas-app-icon.svg` | Ikon aplikasi 512×512 (Android/iOS/PWA). |
| `logo/favicon/pantas-favicon.svg` | Favicon 32×32, detail disederhanakan agar tetap terbaca. |
| `logo/png/` | Hasil render PNG latar transparan untuk keperluan yang tidak menerima SVG (dokumen Office, WhatsApp, spanduk). |

### Ruang aman (clear space)
Sisakan ruang kosong minimal **setinggi ¼ tinggi perisai** di seluruh sisi logo. Tidak boleh ada teks, garis, atau tepi gambar di dalam area itu.

### Ukuran minimum
- Lambang saja: **24 px** (layar) / **8 mm** (cetak)
- Kunci horizontal: **120 px** (layar) / **35 mm** (cetak)
- Di bawah ukuran tersebut, gunakan `pantas-favicon.svg` yang sudah disederhanakan.

### Yang tidak boleh dilakukan
1. Mengubah warna lambang di luar palet resmi (termasuk membuat lonjakan anomali jadi non-merah).
2. Meregangkan, memiringkan, memutar, atau memberi bayangan/bevel.
3. Menyusun ulang jarak lambang dan teks, atau mengganti fonta wordmark.
4. Menempatkan logo di atas foto ramai tanpa lapisan gelap/terang (minimal kontras 4,5:1).
5. Menggabungkan lambang PANTAS dengan logo pihak lain menjadi satu bentuk baru.

---

## 3. Warna

Semua nilai tersedia sebagai variabel CSS di `tokens.css`.

### Warna inti
| Peran | Nama | Hex | Penggunaan |
|---|---|---|---|
| Primer | Biru Niaga 700 | `#0B5FA5` | Identitas, tombol utama, tautan, header |
| Primer gelap | Biru Niaga 900 | `#063B66` | Header gelap, teks di atas biru muda |
| Aksen | Biru Niaga 500 | `#1E88D2` | Seri utama pada grafik, sorotan |
| Sekunder | Hijau Salur 600 | `#00A651` | Status **Normal** / sesuai kuota |
| Kritis | Merah Anomali 600 | `#E4002B` | Status **Anomali**, ambang terlampaui |
| Peringatan | Kuning Tinjau 500 | `#F5A300` | Status **Perlu Ditinjau** |

### Netral
`#0E1520` teks utama · `#5A6B7B` teks sekunder · `#E1E8EF` garis · `#F5F8FA` latar · `#FFFFFF` kartu

### Aturan pakai warna
- **Merah hanya untuk anomali.** Jangan dipakai sebagai warna dekoratif, tombol biasa, atau aksen grafik. Kekuatan sistem ini terletak pada merah yang jarang muncul.
- Rasio kontras teks minimal **4,5:1**; teks besar dan komponen UI minimal **3:1**.
- Status tidak boleh dibedakan **hanya** lewat warna. Selalu sertakan label teks dan ikon — sebagian pengguna lapangan mengalami buta warna, dan laporan sering dicetak hitam-putih.

### Skala status
| Status | Warna | Ikon | Arti |
|---|---|---|---|
| Normal | Hijau | ✓ | Sesuai pola dan kuota |
| Perlu Ditinjau | Kuning | ! | Menyimpang ringan, butuh verifikasi manual |
| Anomali | Merah | ▲ | Melewati ambang, wajib ditindaklanjuti |
| Data Tidak Lengkap | Abu | – | Tidak bisa dinilai |

---

## 4. Tipografi

| Peran | Fonta | Alasan |
|---|---|---|
| Judul / wordmark | **Plus Jakarta Sans** (700–800) | Buatan Indonesia, geometris, resmi tanpa terasa kaku |
| Antarmuka & isi | **Inter** (400–600) | Sangat terbaca pada tabel padat dan layar kecil |
| Angka & kode | **JetBrains Mono** (400–500) | Lebar tetap — angka volume dan selisih sejajar rapi antar baris |

Ketiganya berlisensi bebas (SIL OFL) dan tersedia di Google Fonts, sehingga aman dipasang di server internal tanpa biaya lisensi.

**Aturan angka:** semua volume, selisih, dan persentase memakai fonta monospasi, rata kanan, dengan pemisah ribuan gaya Indonesia — `12.480 L`, `2,8%`.

---

## 5. Penerapan di Aplikasi

- **Header**: logo horizontal di kiri, tinggi lambang 32 px, latar putih atau `#063B66`.
- **Kartu ringkasan**: satu angka besar (monospasi) + label kecil huruf kapital + indikator status.
- **Tabel anomali**: baris anomali diberi garis kiri merah 3 px, bukan latar merah penuh — agar tabel tetap terbaca saat banyak anomali muncul.
- **Grafik**: garis biru untuk nilai aktual, garis abu putus-putus untuk ambang, titik merah untuk anomali.
- **Cetak laporan**: gunakan varian mono pada kop; pastikan status tetap terbaca tanpa warna.

---

## 6. Hubungan dengan Identitas Pertamina

PANTAS adalah **nama produk**, bukan pengganti atau turunan identitas korporat Pertamina.

**Yang sudah dilakukan dalam identitas ini:** palet PANTAS diselaraskan dengan bahasa warna korporat Pertamina (biru, hijau, merah) agar terasa satu keluarga saat dipakai berdampingan, sementara bentuk lambang dibuat sepenuhnya mandiri.

**Aturan bila aplikasi ini resmi dipakai di lingkungan Pertamina:**
1. Logo Pertamina ditempatkan **di kiri**, logo PANTAS di kanan, dipisahkan garis vertikal tipis setinggi 60% tinggi logo. Jarak antar logo minimal 2× lebar garis pemisah.
2. Gunakan berkas logo Pertamina resmi apa adanya — jangan digambar ulang, diwarnai ulang, atau diubah proporsinya.
3. Ruang aman dan ukuran minimum logo Pertamina mengikuti brand guideline Pertamina, bukan dokumen ini.
4. Elemen lambang Pertamina (panah) **tidak boleh** dimasukkan ke dalam lambang PANTAS.
5. Nilai heksadesimal pada dokumen ini adalah nilai kerja PANTAS. Bila brand guideline resmi Pertamina dapat diakses, ganti nilai biru/hijau/merah di `tokens.css` dengan nilai resmi dan perbarui dokumen ini.

**Bila aplikasi ini belum resmi atau dipakai di luar lingkungan Pertamina:** jangan cantumkan nama, logo, atau tipografi korporat Pertamina di mana pun. PANTAS berdiri sendiri tanpa itu — palet biru–hijau di atas tetap sah sebagai warna produk.

---

## 7. Daftar Aset

```
brand/
├── BRAND-GUIDELINE.md              dokumen ini
├── tokens.css                      variabel warna, tipografi, ruang, bentuk
├── preview.html                    pratinjau visual seluruh identitas
└── logo/
    ├── pantas-logo-horizontal.svg          utama
    ├── pantas-logo-horizontal-inverse.svg  latar gelap
    ├── pantas-logo-stacked.svg             bertumpuk
    ├── pantas-mark.svg                     lambang berwarna
    ├── pantas-mark-mono.svg                lambang satu warna
    ├── pantas-wordmark.svg                 wordmark saja
    ├── favicon/
    │   ├── pantas-app-icon.svg             ikon aplikasi 512
    │   └── pantas-favicon.svg              favicon 32
    └── png/                                hasil render latar transparan
        ├── pantas-logo-horizontal-1200.png
        ├── pantas-logo-horizontal-inverse-1200.png
        ├── pantas-logo-stacked-800.png
        ├── pantas-wordmark-1000.png
        ├── pantas-mark-512.png
        ├── pantas-app-icon-1024.png
        ├── pantas-app-icon-192.png
        ├── pantas-favicon-64.png
        └── pantas-logo-sheet.png           lembar kontak semua varian
```

**Catatan produksi:** wordmark pada seluruh berkas SVG sudah berbentuk kurva (outline), bukan elemen `<text>`. Artinya logo tampil sama persis di perangkat mana pun tanpa perlu memasang fonta Plus Jakarta Sans lebih dulu — aman untuk cetak, lampiran email, dan dokumen yang dibuka pihak luar.

Jangan menulis ulang kata "PANTAS" dengan fonta biasa untuk menggantikan berkas ini; jarak antarhurufnya sudah disetel khusus (tracking 2,0 pada ukuran 34) dan tidak akan sama bila diketik ulang.
