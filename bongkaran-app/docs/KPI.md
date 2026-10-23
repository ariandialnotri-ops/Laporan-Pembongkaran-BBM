# Model KPI FLOQ

Rekomendasi KPI per modul untuk SPBU COCO. Semua KPI dihitung otomatis dari data aplikasi untuk bulan berjalan dan tampil sebagai **highlight di bagian atas dashboard**. Kode perhitungan ada di `src/lib/kpi.ts`, tampilannya di `src/components/dashboard/kpi-highlight.tsx`.

## Cara membaca

| Warna | Arti |
|---|---|
| Hijau | Capai target |
| Amber | Mendekati target (di bawah target, masih dalam batas toleransi) |
| Merah | Di bawah target, perlu tindak lanjut |
| Abu-abu | Belum ada data pada bulan ini |

Ketuk kartu KPI untuk melihat definisi, rumus, target, sumber data, dan tombol **Tindak lanjuti** ke halaman terkait.

## Prinsip

1. **Diukur dari data yang memang diisi di FLOQ**, bukan input manual terpisah, sehingga tidak ada beban pengisian tambahan.
2. **Kepatuhan proses** (apakah pemeriksaan dilakukan tepat waktu) dipisah dari **hasil** (apakah hasilnya sesuai standar). Keduanya penting: hasil "sesuai" tidak berarti apa-apa bila pemeriksaannya sering terlewat.
3. Periode **bulan berjalan**, sama dengan siklus laporan SO bulanan, sehingga KPI dapat dibawa ke rapat bulanan.
4. Setiap KPI punya **pemilik tindakan** (peran yang bisa memperbaikinya) dan tautan ke halaman tindak lanjut.

## Dashboard Operation

| Modul | KPI | Rumus | Target | Amber bila | Pemilik |
|---|---|---|---|---|---|
| Operation | Stok awal shift terisi | shift dengan stok awal lengkap ÷ shift yang sudah dimulai | 100% | ≥ 95% | Kepala shift |
| Kualitas | Density harian tepat waktu | hari selesai ≤ 10:00 ÷ hari wajib uji | 100% | ≥ 90% | Kepala shift shift 1 |
| Kualitas | Water content tepat waktu | hari semua tangki diperiksa ≤ 10:00 ÷ hari wajib periksa | 100% | ≥ 90% | Kepala shift shift 1 |
| Kualitas | Uji density sesuai toleransi | uji dalam toleransi ÷ uji yang punya acuan pasca penerimaan | 100% | ≥ 95% | Pengawas |
| Kualitas | Uji pasca penerimaan | penerimaan diuji ÷ bongkaran selesai | 100% | ≥ 90% | Kepala shift |
| Delivery | Bongkaran tanpa anomali | bongkaran selesai normal ÷ bongkaran selesai + anomali | ≥ 98% | ≥ 90% | Pengawas |
| Delivery | Rata-rata gain/loss bongkar | rata-rata (gain/loss ÷ volume DO) | ≥ -0,15% | ≥ -0,30% | Pengawas |
| Delivery | Rata-rata waktu kirim | rata-rata (bongkar selesai − permintaan MS2) | ≤ 24 jam | ≤ 30 jam | Pengawas / ABH |
| Operation | Uji takaran sesuai toleransi | uji bejana 20 L dalam toleransi ÷ total uji | 100% | ≥ 95% | Pengawas |
| Operation | Kepatuhan perawatan | form perawatan harian lengkap ÷ (form × hari) | ≥ 95% | ≥ 80% | Kepala shift |
| Operation | Kepatuhan housekeeping | checklist housekeeping lengkap ÷ (area × hari) | ≥ 95% | ≥ 80% | Cleaning Service |

## Dashboard Sales / Finance

| KPI | Rumus | Target | Amber bila | Pemilik |
|---|---|---|---|---|
| Closing shift tercatat | shift dengan closing ÷ shift selesai | 100% | ≥ 90% | Kepala shift |
| Closing tanpa selisih kurang | closing selisih ≥ 0 ÷ closing yang dapat dihitung | 100% | ≥ 95% | Kepala shift / Admin |
| Totalizer lengkap per shift | shift totalizer awal & akhir lengkap ÷ shift selesai | 100% | ≥ 90% | Kepala shift |
| Realisasi terhadap plafon | total realisasi petty cash ÷ plafon bulan ini | ≤ 100% (hijau ≤ 90%) | 90–100% | Admin/Cashier |
| Settlement ≤ 3 hari | settlement ≤ 3 hari setelah disetujui ÷ (settlement + belum settlement > 3 hari) | ≥ 90% | ≥ 75% | Pengaju |

## Dashboard HSSE & Guard Patrol

| KPI | Rumus | Target | Amber bila | Pemilik |
|---|---|---|---|---|
| Inspeksi APAR bulan ini | unit diinspeksi bulan ini ÷ total unit | 100% | ≥ 80% | Pengawas / Security |
| APAR siap pakai | unit tanpa temuan & masa berlaku aman ÷ total unit | 100% | ≥ 90% | Pengawas |
| Kepatuhan guard tour 7 hari | slot 2 jam dengan sampling JBT & JBKP lengkap ÷ slot yang sudah lewat | ≥ 90% | ≥ 75% | Security |
| Insiden ditutup ≤ 7 hari | laporan ditutup ≤ 7 hari ÷ (ditutup + terbuka > 7 hari) | ≥ 90% | ≥ 70% | Pengawas |
| Lama stop penyaluran | Σ lama penyaluran dihentikan bulan ini | 0, tidak ada yang masih berhenti | ≤ 4 jam total | Pengawas / ABH |

Kepatuhan guard tour hanya tampil untuk ABH, pengawas, dan security (data sampling hanya terbaca peran tersebut).

## Rekomendasi pengembangan berikutnya

- **Target per SPBU** diatur ABH di Pengaturan (sekarang target tetap di kode).
- **Tren 3 bulan** per KPI (sparkline) dan **perbandingan antar-SPBU** untuk ABH multi unit bisnis.
- **Skor kepatuhan SPBU** (rata-rata tertimbang semua KPI) sebagai satu angka di halaman Unit Bisnis.
- Ekspor KPI bulanan ke Excel/PDF untuk rapat bulanan, bersama Laporan SO.
