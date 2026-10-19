# FLOQ (Fuel Logistics Operations & Quality)

Aplikasi evidence dan pemantauan bongkaran BBM serta Quality/Quantity (Q&Q) di
SPBU untuk Kepala Shift, Pengawas, dan Area Business Head.

Logo dan ikon ada di `public/` (`floq-logo.webp` untuk halaman login,
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

**Alur input.** Semua form input berupa halaman tersendiri (bukan pop-up):
1. **Menu pilih**: kartu berwarna. Hijau = sudah diisi, oranye = belum, merah = terlewat, abu-abu = belum waktunya.
   Contoh: Stok Awal & Kualitas Harian = strip 7 hari + 3 kartu shift; Pasca Penerimaan = per penerimaan
   (merah bila shift selesai bongkar sudah lewat tanpa uji); Uji Takaran = per nozzle (hijau bila Preset &
   Manual sudah diuji hari ini); APAR = per unit (merah bila bulan lalu juga terlewat); Operasional = per form.
2. **Halaman form**: panah kembali, sidebar, atau bar bawah selalu meminta konfirmasi sebelum keluar.
3. **Halaman Terkirim** (`/terkirim`): ringkasan data, tombol **Kembali ke Dashboard**, dan langkah berikutnya.

Form pengaturan juga halaman: dispenser/nozzle (`/pengaturan/dispenser/:id`, `/pengaturan/nozzle/:id`), tambah
area APAR, tambah SPBU (`/unit/baru`), ganti kata sandi (`/profil/sandi`), anggota (`/anggota/baru`,
`/anggota/daftar`, `/anggota/sandi/:id`), dan ubah nomor LO saat bongkar.

**Navigasi.** Menu dikelompokkan per peruntukan: **Dashboard**, **Operation** (stok awal shift, input
bongkaran, kualitas harian, kualitas pasca penerimaan, kaleng sample, uji takaran, perawatan &
housekeeping), **Delivery** (plan pengiriman, tracking LO), **HSSE & Guard Patrol System** (inspeksi APAR/APAB, Guard Patrol System: sampling penyaluran subsidi & whistleblowing, laporan insiden &
near miss, sumur pantau & oil catcher), **Finance** (segera hadir), **Report** (riwayat, export file, berita
acara). Item disaring per peran (`src/components/shell/menu-data.ts`).
- **Sidebar**: grup bisa dibuka-tutup, garis cabang, item aktif berupa kartu putih, badge oranye (perlu
  dikerjakan) & hijau (berjalan). Layar lebar: sidebar tetap di kiri, tombol di header menyembunyikan/
  menampilkannya. HP/tablet: laci dibuka dari tombol menu, ditutup dengan menggeser ke kiri / mengetuk latar.
- **Kembali**: panah kembali hanya di sub menu; menu utama (Dashboard, Operation, Delivery, HSSE & Guard Patrol System, Finance, Report, Profil)
  tanpa panah, pindah menu lewat bar bawah/sidebar. Tombol
  tidak membuka lagi halaman Terkirim, form yang sudah ditinggalkan, maupun form/detail di bawah halaman itu
  (setelah hapus atau batal, riwayat diganti, bukan ditambah). Gerakan geser dari tepi kiri dibiarkan untuk "kembali" bawaan iPhone/
  Android; di aplikasi yang dipasang ke layar utama iPhone, geser tepi kiri menjalankan tombol kembali.
- **Sidebar akordeon**: membuka satu grup menutup grup lain; laci HP dibuka dari tombol ☰ dan ditutup dengan
  geser ke kiri.
- **Bar bawah statis** (HP/tablet): menempel penuh di bawah, tidak melayang atau bergeser; berisi grup menu.
- Halaman ikhtisar grup: `/operation`, `/delivery`, `/hsse`, `/finance`, `/laporan` (+ `/laporan/riwayat`,
  `/laporan/export`); `/input` lama dialihkan ke `/operation`.

Dock bawah berisi 4 menu. Dashboard hanya menampilkan data, semua pengisian
ada di Input, semua riwayat dan unduhan ada di Laporan.

| Menu | Rute | Isi |
|------|------|-----|
| Dashboard | `/` | Kartu operasional (tanggal & shift), Status Bongkaran Pekan Ini (7 kotak hari dengan ikon status & titik plan kirim; ketuk tanggal untuk plan, penerimaan, kualitas, kuantitas), Bongkaran Hari Ini per produk (dropdown: MT, diterima, transport loss, discharge loss L & %), SLA rata-rata, Rencana vs Realisasi, Kualitas Harian, Kaleng Sample (D15 sample mobil tangki saat bongkar dari 3 bongkaran terakhir), LO Tracking |
| Input | `/input` | Bar wajib Stok Awal Shift + kartu: |
| | `/stok` | Stok awal tiap produk (wajib tiap awal shift) dan pengeluaran dispenser; simpan lalu ke Catatan Persediaan |
| | `/air` | **Water Content Tangki** (ABH, pengawas, kepala shift): **sekali sehari di shift 1, paling lambat 10:00** (strip 7 hari hijau/oranye/merah; hanya hari ini yang dapat diisi, lewat 10:00 dicatat *terlambat*). Form `/air/isi` semua tangki pendam: tinggi air (mm, tombol Nihil = 0), volume air dari tabel kalibrasi, foto stik pasta air, tindakan wajib bila ada air. Isian disimpan di `bbm_air` (shift 1); **foto tidak disimpan**: digabung menjadi kolase grid (garis putih tipis, cap waktu/SPBU/tangki/hasil) lalu **Kirim ke WhatsApp** bersama teks laporan (blok monospace, titik dua sejajar) |
| | `/laporan/air` | Riwayat water content per bulan: jumlah pengecekan, temuan air, shift terlewat, rincian per tangki + foto; hapus oleh ABH/pengawas |
| | `/input/bongkar` | Input Bongkaran: mulai bongkaran baru (terkunci sampai stok awal diisi) dan bongkaran berjalan |
| | `/input/:id` | Form bongkaran 14 langkah SOP + tab Finish. Kompartemen: tinggi T2 mobil tangki (acuan deepstick), kapasitas, dan kepekaan (L/mm) dari buku tera MT; selisih liter = kepekaan x selisih mm (0,3 L/mm x -5 mm = -1,5 L). Tanda tangan lewat pop up berkotak panduan. Unduhan: Excel, PDF BA saja (cepat), PDF + foto, JPG. Konfirmasi saat keluar dari form yang belum selesai; bongkaran selesai tidak dapat dihapus |
| | `/plan` | Plan Pengiriman: permintaan MS2 (bottom sheet), shift permintaan dipilih per produk (tidak ada shift tingkat plan); tabel LO (tgl kirim, SO, LO, produk, volume, shift, supply point, MS2, status), volume permintaan dipecah otomatis **tiap 8.000 L = 1 LO** (maks. 8.000 L per LO). Ketuk baris untuk membuka halaman **Edit SO & LO** (nomor segel tidak diisi di sini; dicocokkan dengan dokumen LO fisik saat bongkar). Plan dengan tanggal kirim mendatang (mis. besok) selalu tampil, apa pun filter presetnya. Pengingat harian pukul 06:00 bila plan besok belum dibuat |
| | `/plan/so/:id` | Edit SO & LO satu permintaan dalam bentuk tabel: Nomor SO, lalu per LO produk, volume (maks. 8.000 L), shift, nomor LO, status, alih supply; LO Closed terkunci. Simpan otomatis kembali ke Tracking LO asal (Plan Pengiriman atau Riwayat Tracking LO) |
| | `/kualitas` | Kualitas Harian: **sekali sehari di shift 1, paling lambat 10:00** (pilihan harian seperti water content). Density & suhu per produk, tiap baris disimpan sendiri; foto hydrometer per produk + struk pump test + pengembalian minyak digabung menjadi kolase dan dikirim ke WhatsApp bersama laporan (D15, acuan bongkaran, selisih, pump test); foto tidak disimpan |
| | `/sample` | Uji Kualitas Pasca Penerimaan: uji density tangki pendam setelah bongkar selesai, jam uji diatur petugas, wajib untuk setiap penerimaan; dibanding D15 depot |
| | `/apar` | Dashboard APAR & APAB: kondisi baik/temuan, belum diperiksa bulan ini, isi ulang lewat/≤30 hari, **uji instansi (12 bulan) lewat/≤30 hari/belum dicatat**, per area, daftar unit; tombol Inspeksi unit, Pindai QR (lihat data unit), Label QR & Data utama (ABH) |
| | `/apar/inspeksi` | Inspeksi **per unit di lokasi**: tombol Pindai QR unit, atau ketik kode bila label rusak; progres bulan ini (belum/sudah per unit). Tidak ada inspeksi massal |
| | `/apar/inspeksi/:id` | Form satu unit: checklist (posisi, tanda, tekanan, pin & segel, tabung, selang, label, kartu, masa isi ulang, roda APAB), catatan (wajib bila temuan), **foto wajib**, petugas; **Kirim** menyimpan unit itu saja lalu kembali ke pemindai. Unit yang sudah dikirim hari ini tampil hasilnya + tombol koreksi |
| | `/apar/data` | Data utama (ABH & Pengawas): **daftar unit tersimpan** (tabel, saring APAR/cadangan/APAB) dan daftar area (tambah lewat bottom sheet, hapus bila kosong); jumlah pulau dari Pengaturan SPBU |
| | `/apar/data/unit/:id` | Form tambah (`baru`) / ubah unit (**hanya ABH & pengawas**): tipe, kode (unik), kapasitas, jenis, **sistem DCP: Pressure System (ada manometer) / Cartridge (tanpa manometer; checklist inspeksi mengganti butir manometer dengan butir cartridge gas pendorong)**, lokasi, jadwal isi ulang, **tanggal pemeriksaan instansi berwenang + nama instansi (berlaku maks. 12 bulan)**, cadangan; Simpan kembali ke daftar; hapus, label QR |
| | `/apar/label` | Label QR per unit untuk dicetak/disimpan PDF dan ditempel di tabung: pita merah berisi nama SPBU utuh, QR, kode besar, tipe, jenis & kapasitas, lokasi. Centang label yang ingin dicetak, lalu unduh **PDF A4** (8 label per lembar) atau **JPG 300 dpi**: per label (92 × 66 mm) atau lembar A4; lebih dari satu gambar dibungkus ZIP |
| | `/apar/unit/:id` | Tujuan QR (kamera HP): data unit, kondisi terakhir (temuan, catatan, foto), **kalender kepatuhan inspeksi bulanan** (JAN–DES per tahun: baik / temuan / terlewat / bulan ini, persentase kepatuhan, data setahun dari server), riwayat, tombol Inspeksi unit ini |
| Laporan | `/laporan` | Kartu laporan: |
| | `/laporan/persediaan` | Catatan Persediaan BBM, unduh Excel/PDF sesuai template |
| | `/laporan/ba` | Berita Acara: status tanda tangan, buka untuk TTD pengawas/ABH atau unduh |
| | `/laporan/bongkaran` | Riwayat Pembongkaran MT: produk, tanggal penerimaan, SO, LO, nopol & supir, volume, transport loss, discharge loss (L, %), SLA (request MS2 / gate out sampai selesai bongkar), keterangan, progress |
| | `/laporan/lo` | Riwayat Tracking LO: tanggal permintaan kirim, SO, LO, produk, volume, supply point, nopol MT, status; ketuk baris untuk ubah lewat pop up (LO Closed terkunci) |
| | `/laporan/kualitas` | Riwayat Kualitas Harian: uji harian dan uji pasca penerimaan; baris yang baru dikirim disorot biru. Ketuk baris → `/laporan/kualitas/:kunci` (highlight data: D15 besar, selisih vs acuan, status, density, suhu, petugas, foto; info bongkaran kecil) |
| | `/laporan/takaran` | Riwayat Uji Takaran + cetak BA (alamat lama `/laporan/tera` dialihkan ke sini) |
| | `/laporan/apar` | Riwayat Inspeksi APAR & APAB: satu baris per unit per inspeksi, filter temuan |
| | `/insiden/baru` | **Lapor Insiden / Near miss / Kerusakan** (semua peran): jenis, kategori, tanggal & jam, lokasi, peralatan, uraian, dampak (wajib untuk insiden), penyebab, tindakan, tingkat risiko, foto (wajib untuk insiden & kerusakan), pelapor; kirim lalu ke riwayat. Pintasan: **tombol bulat biru (ikon pindai) "Lapor" di tengah bar bawah** membuka `/lapor`: kamera langsung aktif (mode **Foto** maks. 4 atau **Video** maks. 30 detik tanpa suara, cap tanggal, jam & SPBU tertulis di gambar/setiap bingkai video; cadangan: kamera/galeri HP), lalu pilih **Lapor insiden / near miss / kerusakan** dan form jenis itu terbuka dengan foto/video terlampir (video tersimpan di bucket `bbm-evidence`, migrasi `20261017140000_bbm_video_insiden.sql`, ikut cut-off tanggal 5); urutan bar bawah Dashboard, Operation, Lapor, Delivery, HSSE & Patrol (Report lewat sidebar). Kerusakan: pilihan **pemberhentian penyaluran sementara** (pilih produk + waktu mulai), tampil di menu insiden selama berhenti |
| | `/ops` | **Operasional SPBU** (format laporan operasional SPBU): kartu perawatan (pompa & tangki pompa dorong, rutin pompa & tangki, APAR/APAB harian, ruang panel listrik, genset, totem, kanopi pompa, outlet ritel), checklist housekeeping (**hanya Cleaning Service**; pengawas/ABH hanya memaraf), sumur pantau & oil catcher (kashift/security). Per tanggal; tanda baik / X / –; X wajib catatan + foto (foto hanya saat temuan); paraf pengawas per form atau massal. Form yang tampil mengikuti peran dan **Fasilitas SPBU** di Identitas SPBU. Kartu **Perawatan Pompa Dorong, Tangki Pompa Dorong, dan Rutin Pompa & Tangki dibuat per tangki pendam** (Database Tangki; produk & kapasitas di kepala kartu, Excel/PDF satu sheet per tangki). Tiap form menampilkan **Ketentuan jadwal** (harian, 3 harian, mingguan, bulanan, cuci tangki 5 tahun sekali) dan aktivitas berkala yang jatuh tempo disorot oranye |
| | `/ops/kalender` | **Kalender progres** housekeeping / perawatan: persentase form harian lengkap tiap tanggal, kepatuhan bulanan, temuan, dan daftar aktivitas berkala jatuh tempo hari ini. PDF Laporan Operasional kini digambar dari layout template Excel (satu kartu per halaman A4 lanskap) sehingga sama dengan Excel |
| | `/grounding` | **Pengukuran Grounding SPBU** (HSSE; kepala shift, pengawas, ABH): titik ukur otomatis dari data SPBU (tangki pendam + vent & fill point, dispenser/pulau pompa, panel listrik, penangkal petir/kanopi, fasilitas, area APAR). Isi tahanan Ω per titik (batas ≤ 5 Ω, di atas batas wajib tindak lanjut), alat, petugas, foto; ukur ulang tiap 6 bulan. Tabel `bbm_grounding` |
| | `/personil` | **Personil & Jadwal Shift** (semua peran melihat; pengawas/ABH mengubah): personil yang **sedang bertugas** di shift berjalan, jadwal hari ini per shift, daftar personil (nama, jabatan, HP, aktif). `/personil/jadwal`: grid personil × tanggal (1/2/3/Libur/Cuti/Izin, ketuk untuk berganti, ulangi pola 7 hari), jumlah personil per shift. Tabel `bbm_jadwal`, daftar di pengaturan `personil` |
| | `/laporan/ops` | Rekap bulanan per form (status tiap tanggal), daftar temuan, unduh **Excel format asli** (template `public/templates/ops-template.xlsx`, sheet BREAK DOWN dari laporan kerusakan) atau **PDF** (A4 mendatar: kartu per form aktivitas × tanggal, form bulanan × bulan, sumur pantau, oil catcher, temuan dengan foto, breakdown, kolom pengesahan pengawas) |
| | `/laporan/insiden` | Riwayat insiden: filter tanggal/jenis/status, baris terbuka oranye, baru biru; `/laporan/insiden/:id` detail + tindak lanjut (status, PIC, target, catatan) oleh ABH/Pengawas/Kashift. Tindak lanjut dapat melampirkan **foto** (maks. 4) dan **berita acara** (PDF ≤ 8 MB atau foto, maks. 3). **Semua peran (termasuk security, cleaning service, Admin/Cashier) dapat menambah tindak lanjut dan menutup (Selesai)** laporan kerusakan, near miss, dan insiden |
| | `/gts` | **Sampling Penyaluran Subsidi** (Guard Patrol System, khusus security): hari operasional 06:00–05:59 dibagi 12 slot 2 jam; tiap slot minimal 1 transaksi **JBT** (Biosolar) dan 1 **JBKP** (Pertalite). Kotak slot hijau/oranye/merah/abu; hanya slot berjalan yang dapat diisi. Form `/gts/isi`: jenis penyaluran, nopol, jenis kendaraan, volume, sesuai ketentuan (+ keterangan), foto **EDC**, **struk**, **kendaraan** (cap waktu, tanggal, nama & kode SPBU). **Hemat penyimpanan**: hanya isian yang disimpan; ketiga foto otomatis digabung menjadi **satu kolase** 1600×1200 (kiri atas EDC, kiri bawah struk, kanan kendaraan, garis putih tipis, cap waktu & SPBU per bagian; foto beda orientasi ditampilkan utuh) lalu dikirim lewat **Kirim ke WhatsApp** (lembar berbagi: kolase + teks *Laporan Sampling Penyaluran Subsidi Tepat JBT/JBKP* dengan isian dalam blok monospace WhatsApp sehingga titik dua sejajar; komputer: kolase diunduh + wa.me). Keluar sebelum foto terkirim meminta konfirmasi |
| | `/laporan/gts` | Riwayat Guard Tour per tanggal: kepatuhan slot, jumlah sampling JBT/JBKP, isian (shift, kendaraan, volume, sesuai/tidak), kirim ulang teks ke WhatsApp; hapus oleh ABH/Pengawas (foto hanya pada catatan lama) |
| | `/patrol` | **Guard Patrol System** (HSSE & Guard Patrol System): menu Sampling Penyaluran Subsidi (`/gts`, security) dan Whistleblowing System (`/wbs`, semua peran) |
| | `/wbs` | **Whistleblowing System** (semua peran): pilih jenis pelanggaran → form (waktu, lokasi, pihak terlibat, uraian, foto bukti opsional, anonim bawaan). Laporan dikirim lewat edge function `bbm-wbs`; laporan anonim tidak menyimpan akun pelapor (termasuk pemilik objek foto) |
| | `/laporan/wbs` | Laporan WBS, **hanya ABH**: filter status (baru/ditinjau/selesai), detail `/laporan/wbs/:id`, tindak lanjut + riwayat. Pengawas, kepala shift, security, dan CS tidak dapat membaca laporan maupun foto buktinya (RLS tabel `bbm_wbs` & storage folder `wbs-*`) |
| | `/totalizer` | **Totalizer** (Operation; security, kepala shift, pengawas, ABH): totalisator digital setiap nozzle di **awal & akhir shift** (pilih shift hijau/oranye/merah). Nozzle dikelompokkan per dispenser & pulau pompa; awal shift otomatis dari akhir shift sebelumnya; boleh dikirim di awal shift lalu dilengkapi akhir shift. Tabel `bbm_totalizer` |
| | `/laporan/totalizer` | Riwayat totalizer per bulan: penjualan per produk per shift, rincian nozzle, rekap per nozzle |
| | `/laporan/pump-test` | **Riwayat Pump Test**: pump test uji kualitas (nozzle sampel dipilih di Kualitas Harian), uji kuantitas Q&Q, dan uji takaran (20 L) per nozzle & produk, rekap per nozzle |
| | `/stop-penyaluran` | **Stop Penyaluran** (Operation, semua peran; terpisah dari laporan kerusakan): dashboard status penyaluran sekarang, kejadian/masih berhenti/total & rata-rata lama berhenti per bulan, lama berhenti per produk, alasan. Form `/stop-penyaluran/baru`: produk (pilih banyak), mulai berhenti, alasan, lokasi, nozzle, uraian, tindakan, foto opsional (juga dari kamera **Lapor**). Tindak lanjut / closing di detail laporan menampilkan **jam penyaluran kembali** (wajib saat Selesai, tidak boleh sebelum mulai berhenti); lama berhenti dihitung otomatis. Kartu **Status penyaluran** di Dashboard utama & Dashboard Security |
| | `/laporan/henti` | **Riwayat Stop Penyaluran**: produk, mulai berhenti, penyaluran kembali, lama, alasan, status (termasuk pemberhentian lama yang tercatat di laporan kerusakan) |
| | `/laporan/so` | **Laporan Stock Opname** (Report; ABH, pengawas, admin isi; kepala shift lihat): BA Laporan Bulanan sesuai dokumen SPBU — SO tangki (dipping vs ATG, konsistensi ≤ 2,5 cm terhadap SO lalu, volume dari tabel kalibrasi) & meter listrik, totalisator (digital ditarik dari Totalizer), arus minyak & losses, penerimaan (Input Bongkaran), rekap tera nozzle (pump test), cash opname BBM/LPG/Enduro/petty cash, justifikasi, update pekerja. **Unduh Excel** 12 lembar. Tabel `bbm_so` |
| | `/finance/closing` | **Closing Shift** (kepala shift, hitung buta): pecahan uang, non tunai & non BBM dengan kolom sama seperti `evidence_closing` aplikasi One Touch Solution; penjualan BBM = totalizer shift × harga jual (diatur ABH/pengawas); setelah kirim terkunci (hanya ABH ubah/hapus), rekonsiliasi tunai seharusnya vs fisik, kolase foto struk + **Kirim ke WhatsApp** (foto tidak disimpan). Tabel `bbm_closing` |
| Finance | `/finance` | Grup Finance: **Closing Shift**, **Petty Cash**, dan sub menu **Realisasi Petty Cash** (ABH, Admin/Cashier, pengawas, kepala shift). Admin/Cashier juga melihat Finance di bar bawah |
| | `/finance/petty` | Petty cash: sub menu Pengajuan & Realisasi; plafon per bulan diatur ABH. **Plafon, anggaran disetujui, realisasi, sisa, dan menu Realisasi hanya untuk Admin/Cashier & ABH**; peran lain hanya melihat nominal pengajuannya sendiri |
| | `/finance/petty/pengajuan` | **Pengajuan Pengadaan / Reimburse**: daftar per bulan (filter perlu tindakan/menunggu/disetujui/ditolak). Pengaju: kepala shift, pengawas, Admin/Cashier, security, cleaning service — **ABH tidak mengajukan** (pemberi persetujuan akhir). Form `/finance/petty/pengajuan/baru`: jenis **Pengadaan** (minta dana dulu) atau **Reimburse** (sudah dibayar pengaju, nota wajib), barang/jasa, jumlah × harga, vendor, keperluan; **tanpa akun COA** (dipilih saat realisasi); nomor `PC-YYYYMM-001`. Alur: persetujuan 1 Admin/Cashier → persetujuan akhir ABH (pengajuan admin langsung ke ABH; tolak wajib catatan). Peran pengaju dicatat (`data.peran`): security & CS hanya melihat pengajuan perannya sendiri. Detail `/finance/petty/pengajuan/:id` |
| | `/finance/petty/realisasi` | **Realisasi Petty Cash** (hanya Admin/Cashier & ABH): pengajuan disetujui yang belum direalisasi, progres terhadap plafon, rekap per akun COA, dan **voucher realisasi** (satu per tanggal, nomor `tgl/COCO/MM/YYYY`) yang dapat diunduh Excel sesuai format Voucher Realisasi Petty Cash. Form `/finance/petty/realisasi/:id`: **akun COA wajib**, tanggal, nominal, foto nota (pengadaan) atau bukti bayar opsional (reimburse: *Bayar reimburse*). Foto petty (`petty-*`) tidak ikut cut-off tanggal 5 |
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
Pemindai di aplikasi membuka kamera belakang langsung di semua HP (iPhone Safari/PWA, Android, desktop): dibaca BarcodeDetector bila ada, selain itu **jsQR** (dimuat hanya saat memindai). Tersedia tombol senter (bila kamera mendukung), **Ambil foto label** bila kamera tidak bisa dibuka, dan ketik kode unit bila label rusak. Selain URL label FLOQ, QR/barcode yang hanya berisi kode unit (mis. `APAR-01`) juga dikenali. Kamera butuh alamat https dan izin Kamera di browser.

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
Volume tangki : interpolasi linear tabel kalibrasi per tangki (database tangki SPBU aktif; mode lokal: src/data/tankTables.json)
Gain / loss   : real stok ATG − (stok awal ATG + volume DO)
Deepstick     : volume setelah − volume sebelum, dibanding volume DO
Uji harian    : D15 uji kualitas harian − D15 uji pasca penerimaan terbaru produk itu (bukan kaleng sample MT), ≤ toleransi density
```

Toleransi default (density 0,003; tera 10 mm; ATG 10 menit; volume per DO
8.000 L) bisa diubah di Pengaturan. Data acuan tabel ada di `src/data/`
(`table53.json`, `tankTables.json`).

## Uji Takaran (bejana 20 L)

Tera takaran tidak lagi diisi di Kualitas Harian (form itu kini hanya density & suhu, dengan
tautan ke Uji Takaran). **Dashboard** punya kartu **Uji Takaran**: hasil hari ini (dan yang lewat
toleransi), lewat toleransi bulan ini, nozzle diuji bulan ini x/total, uji terakhir, serta hasil
terakhir per nozzle untuk P dan M (merah bila lewat). Detail tanggal di kalender Dashboard dan
penanda anomali kalender juga memakai data Uji Takaran.

Menu tersendiri di **Input > Uji Takaran** (`/takaran`, kepala shift, pengawas, ABH):
nomor nozzle & produk diketik manual (ada saran dari data nozzle), pilih opsi **P (Preset)** atau
**M (Manual)**, isi selisih terhadap 20 L dalam ml. Selisih di bawah **-60 ml** = melebihi toleransi
(merah, catatan tindak lanjut). Wajib foto **dudukan bejana & water pass (stabil)** dan **hasil
pengukuran**; setiap foto diberi cap tanggal, jam, zona waktu, SPBU, nozzle, dan opsi yang
tertulis di gambar. Satu hasil dikirim satu per satu; setelah kirim, nozzle & produk tetap dan
opsi pindah ke yang belum diuji. Daftar "Hasil uji hari ini" bernomor (mis. "1. Nozzle 3
Pertalite, Preset = -40 ml"). Keluar dengan isian/foto belum terkirim meminta konfirmasi.
Riwayat di **Laporan > Riwayat Uji Takaran** (`/laporan/takaran`): filter tanggal, saring
melebihi toleransi / sesuai, pop up detail + foto, hapus (pengawas/ABH atau pengirim di hari yang sama).
Di halaman yang sama ada **Berita Acara Uji Takar** per tanggal uji (`src/lib/report/ba-takar.ts`,
jsPDF): **BA saja (PDF)** atau **BA + Lampiran foto (PDF)**. Isi BA: judul "Berita Acara Uji Takar
- Tera Bejana Ukur 20 L", nama SPBU, Informasi SPBU & Uji Takar (nomor & nama SPBU, alamat,
No. Berita Acara `UT/<kode>/<xxxx>`, tanggal uji & laporan, petugas, jam uji), tabel Hasil Uji Takar
per Nozzle (nozzle, tanggal & jam, produk, mode P/M, hasil tera ml, Qty Var % = hasil/20.000 ml, Sesuai / Tidak
Sesuai), ringkasan nozzle diperiksa & di bawah toleransi, tanda tangan Petugas Uji dan Manajer /
Pengawas SPBU, kaki halaman "FLOQ · No. BA", kode verifikasi, nomor halaman. Lampiran: dua hasil per
halaman, foto dudukan bejana & water pass dan hasil pengukuran (bercap waktu).

## Konfirmasi & notifikasi proses

- **Modal konfirmasi** (`src/components/ui/konfirmasi.tsx`, `useKonfirmasi()`), pengganti `window.confirm`:
  kartu di tengah layar dengan ikon & tombol aksi yang jelas. `hapus` (merah, "Tidak, simpan" /
  "Ya, hapus", ditambah "Tindakan ini tidak dapat dibatalkan"), `ubah` (oranye, untuk mengubah data
  riwayat yang sudah terkirim: totalizer lengkap, stok awal, water content, catatan operasional,
  buka ulang bongkaran) dan `kirim` (biru, mis. kirim & kunci closing).
- **Lembar proses** (`src/components/ui/lembar-proses.tsx`, `src/lib/proses.ts`): setiap kirim,
  unggah foto/video, dan hapus lewat backend dilacak otomatis. Proses >0,4 detik menampilkan
  "Mengunggah…" / "Memproses…" / "Menghapus…" (tidak bisa ditutup selama berjalan), lalu
  "Berhasil!" / "Berhasil dihapus" (tutup otomatis). Bila halaman pindah ke Terkirim, halaman itu
  yang menjadi tanda berhasil. Galat menutup lembar dan pesan galat tetap dari halaman. Penyimpanan
  latar (autosave draf bongkaran) dibungkus `diam()` sehingga tidak memunculkan lembar.

## Multi SPBU

Satu aplikasi untuk banyak SPBU, polanya sama dengan aplikasi Monitoring JBT:

- **ABH** mengendalikan beberapa unit bisnis. Nama SPBU di header adalah **pemilih SPBU**
  (ketuk untuk berpindah). **Profil > Unit bisnis** (`/unit`) menampilkan dashboard semua SPBU:
  kartu Data siap, Q&Q hari ini, Bongkaran bulan ini, Insiden terbuka; tabel **Progres per SPBU**
  (cari, saring Semua / Perlu perhatian / Belum siap / Siap, garis Q&Q 7 hari, bongkaran & anomali,
  APAR bulan ini, insiden, jumlah pengawas/akun). Ketuk baris untuk membuka SPBU itu. Tombol
  **Tambah SPBU** membuat unit baru; akun pengawas/kashift/security dibuat di Anggota untuk SPBU aktif.
- **Super Admin** (admin aplikasi) adalah ABH yang tercatat di `bbm_private.bbm_superadmin`
  (migrasi `20261018130000_bbm_superadmin.sql`): otomatis mengendalikan **semua SPBU**, termasuk
  yang dibuat kemudian, dan di Anggota boleh mengubah peran, mengatur ulang sandi, atau menghapus
  akun ABH lain. ABH biasa tidak dapat mengubah akun ABH lain maupun Super Admin. Daftar Super Admin
  hanya diubah lewat SQL Editor (lihat komentar di akhir migrasi); tidak bisa lewat aplikasi/API.
- **Pengawas, kepala shift, security** terikat ke satu SPBU dan hanya melihat data SPBU itu.
- **SPBU tanpa identitas wajib disiapkan dulu**: selama identitas (nama, kode, jumlah pulau pompa)
  belum ada, pengawas & ABH diarahkan ke **Siapkan Data SPBU** (`/siapkan`): 1) Identitas SPBU,
  2) Database tangki (**boleh menyusul**). Kepala shift & security melihat pesan "Data SPBU belum
  lengkap" sampai identitas diisi.
- **Tanpa database tangki** semua modul tetap jalan (kualitas harian, uji takaran, APAR, insiden,
  plan, bongkaran). Yang menunggu tabel kalibrasi: stok awal shift (tidak diwajibkan dulu),
  pilihan tangki & hitung volume dari tinggi di form bongkaran, kalkulator volume. Kartu kuning
  "Database tangki belum diisi" tampil di Dashboard, menu Input, Stok Awal, dan Input Bongkaran
  (dengan tombol isi untuk pengawas/ABH).
- **Database tangki** (`/pengaturan/tangki`): tiap tangki = produk, nomor, tanggal kalibrasi,
  tabel kalibrasi. Tabel ditempel dari Excel (blok kolom tinggi & volume, salin, tempel; beberapa
  pasang kolom berdampingan juga terbaca) atau file CSV, satuan tinggi mm atau cm. Pratinjau
  menampilkan jumlah baris, rentang tinggi, kapasitas, titik volume turun, dan uji tinggi → volume.
- Semua akun & data lama milik **SPBU COCO Kediri** (SPBU pertama); tabel kalibrasi tangki Kediri
  dipindahkan ke database tangkinya.

## Struktur

```
src/
  components/ui/         primitif kaca: glass-card, pill, button, input, select, tabs, toast, spring-value
  components/shell/      header (tombol kembali), dock navigasi, ambient orbs, app-shell, app-provider (state global)
  components/bongkaran/  langkah SOP, slot foto, panel finish, tanda tangan, filter tanggal, stok-gate, stat-tile, qq-pill
  pages/                 Dashboard, InputMenu, FormInput, FormBongkar, Plan, EditLo, QqHarian, Sample2Jam, StokShift,
                         LaporanMenu, Persediaan, BeritaAcara, RiwayatBongkaran, RiwayatLo, RiwayatKualitas, RiwayatTera,
                         Kalkulator, Profil, Pengaturan, Anggota, Login, Spbu (Unit Bisnis, Siapkan SPBU), Tangki
  lib/sop.ts             definisi 14 langkah, validasi & hitungan bongkaran
  lib/plan.ts            status SO/LO
  lib/shift.ts           pembagian shift
  lib/daily.ts           stok shift & Q&Q harian
  lib/report/            ekspor BA & Catatan Persediaan (xlsx dari template, PDF/JPG via canvas)
  lib/density.ts         density @15°C (ASTM 53)
  lib/tank.ts            database tangki SPBU aktif, volume dari ketinggian, baca tabel kalibrasi tempelan
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
`20261009120000_bbm_save_apar.sql`, `20261009130000_bbm_save_settings_terbatas.sql` (RPC: pengawas menyimpan unit & area APAR serta Sold To/Ship To saja), dan `20261009140000_bbm_daily_insiden.sql` (kind `insiden`, semua peran boleh melapor), lalu
`20261010120000_bbm_multi_spbu.sql` (multi SPBU), `20261010120100_bbm_tangki_kediri.sql`
(tangki Kediri), dan `20261011120000_bbm_takar.sql` (uji takaran). Edge function `supabase/functions/bbm-akun` membuat akun & mengatur ulang kata
sandi (khusus ABH, hanya untuk SPBU yang dikendalikannya):

| Objek | Isi |
|-------|-----|
| `bbm_spbu` | Satu baris per SPBU (unit bisnis); nama & kode mengikuti Identitas SPBU |
| `bbm_abh_spbu` | SPBU yang dikendalikan tiap ABH |
| `bbm_members` | Anggota, peran (`abh` / `pengawas` / `kashift` / `security` / `cs` / `admin`), dan `spbu_id` tempat bertugas |
| `bbm_settings` | Pengaturan per SPBU (`id` = `spbu_id`) |
| `bbm_tanks` | Database tangki per SPBU: produk, nomor, tanggal kalibrasi, tabel kalibrasi (jsonb) |
| `bbm_plans` | Plan kirim (SO & LO); data MS2, Ship To, PO SAP, supply point di kolom `meta` |
| `bbm_daily` | Stok awal shift (`kind = stok`, satu per shift) dan Q&Q harian (`kind = qq`) |
| `bbm_takar` | Uji takaran bejana 20 L: satu baris per hasil (nozzle, produk, opsi P/M, selisih ml, foto); dibaca aplikasi sebagai catatan harian kind `takar` |
| `bbm_ops` | Operasional SPBU: satu baris per form per tanggal (form bulanan: tanggal 1). Tulis: housekeeping `hk-*` hanya CS (ABH/pengawas hanya mengubah paraf, dijaga `bbm_ops_jaga`), sumur pantau & oil catcher kashift/security, kartu perawatan kashift; ABH & pengawas semua. Paraf hanya ABH/pengawas (trigger) |
| `bbm_petty` | Petty cash: pengajuan pengadaan / reimburse (peran pengaju `data.peran`, akun COA diisi saat realisasi oleh Admin/Cashier, total, status `Menunggu Admin` → `Menunggu ABH` → `Disetujui`/`Ditolak`) + realisasi & nota di kolom `data`. Alur dijaga trigger `bbm_petty_alur` (`20261016140000_bbm_petty.sql`, `20261016150000_bbm_admin_peran.sql`, `20261016150100_bbm_admin_petty_alur.sql`) |
| `bbm_grounding`, `bbm_jadwal` | Pengukuran grounding per tanggal dan jadwal shift per bulan (`20261019120000_bbm_ops_petty_grounding_personil.sql`) |
| `bbm_totalizer`, `bbm_closing`, `bbm_so` | Totalizer per shift, closing shift (terkunci setelah kirim), stock opname per bulan (`20261017120000_bbm_totalizer_closing_so.sql`, juga mengisi 9 nozzle SPBU Kediri dan harga jual di RPC pengawas) |
| `bbm_cutoff_log` | Catatan cut-off foto per SPBU |
| `bbm_reports` | Satu baris per bongkaran; isi langkah SOP di kolom JSON |
| bucket `bbm-evidence` | Foto evidence (privat, diakses lewat signed URL) |

Semua tabel data punya `spbu_id`. RLS: hanya anggota SPBU itu dan ABH pengendalinya yang bisa
membaca/menulis (`bbm_private.bbm_spbu_saya()`); foto disimpan di folder `<spbu_id>/…`. RPC:
`bbm_buat_spbu`, `bbm_ringkasan_unit`, `bbm_save_settings_terbatas(p_spbu, p_patch)`,
`bbm_add_member(…, p_spbu)`. Peran:

| Peran | Modul |
|-------|-------|
| ABH | Beberapa SPBU (unit bisnis) + semua modul, Anggota (buat akun), Pengaturan SPBU, Data utama APAR, Label QR |
| Pengawas | Identitas SPBU (termasuk jumlah pulau pompa) & Database tangki (wajib diisi untuk SPBU baru), tambah/ubah Data Dispenser (pulau pompa tiap dispenser) dan Nozzle & Tera Metrologi (`20261016120000_bbm_pengawas_dispenser_nozzle.sql`), Dashboard, stok awal, Input Bongkaran & TTD BA, Plan Pengiriman & Tracking SO/LO, Data utama APAR/APAB & area, Label QR, Inspeksi APAR/APAB, Water Content Tangki, Kualitas Harian, Uji Pasca Penerimaan, semua laporan |
| Kepala Shift | Dashboard (sama dengan pengawas), pengajuan petty cash, pengukuran grounding, stok awal, Water Content Tangki, Input Bongkaran, Kualitas Harian, Plan & Tracking SO/LO, Inspeksi APAR/APAB, laporan terkait |
| Security | Dashboard Security (pembongkaran, Tracking LO, kepatuhan guard tour sampling JBT/JBKP, progres kerusakan/insiden/near miss, petty cash pengajuan security), Inspeksi APAR/APAB, sumur pantau & oil catcher, ajukan petty cash, lapor insiden |
| Cleaning Service (CS) | Dashboard Cleaning Service (progres & kepatuhan housekeeping, jadwal pembersihan berkala, petty cash pengajuan CS, kerusakan/insiden/near miss), satu-satunya pengisi checklist housekeeping, ajukan petty cash, lapor insiden |
| Admin / Cashier | Finance: persetujuan 1 petty cash (lalu diteruskan ke ABH), pengajuan & realisasi anggaran |

Tulis: plan & laporan oleh ABH/Pengawas/Kashift; Security hanya `bbm_daily`
kind `apar`; pengaturan & anggota hanya ABH; hapus plan/laporan oleh ABH/Pengawas
(draft milik sendiri boleh dihapus pembuatnya). Daftar halaman per peran ada di
`src/lib/roles.ts`. Pengguna pertama yang login otomatis menjadi ABH, lalu
membuat akun lain di `/anggota`.

**Cut-off foto (Supabase Free 1 GB).** Setiap tanggal 5 pukul 01.00 WIB, `pg_cron` memanggil edge
function `bbm-cutoff` (kunci pemanggil acak di Vault `bbm_cutoff_key`, tidak ada di repo). Foto di
`bbm-evidence` yang diunggah sebelum tanggal 1 (bulan ini − *Lama foto disimpan*, bawaan 3 bulan,
diatur ABH di Identitas SPBU) dihapus lewat Storage API; data laporan tetap. Tanggal 1–4 ABH/pengawas
melihat banner di Dashboard & Operasional SPBU untuk mengunduh arsip ZIP (`bbm_foto_arsip`). Foto
yang sudah terhapus tampil sebagai "Foto diarsipkan".

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
