/**
 * Judul header dan menu induk (tujuan tombol kembali) tiap halaman. Menu dikelompokkan per
 * peruntukan: Dashboard, Operation, Delivery, HSSE, Finance, Report (lihat components/shell/menu-data.ts).
 */
const GRUP: { href: string; title: string }[] = [
  { href: '/', title: 'Dashboard' },
  { href: '/operation', title: 'Operation' },
  { href: '/delivery', title: 'Delivery' },
  { href: '/hsse', title: 'HSSE & Guard Patrol System' },
  { href: '/finance', title: 'Finance' },
  { href: '/laporan', title: 'Report' },
  { href: '/profil', title: 'Profil' },
]

/** Halaman di bawah grup menu: judul header dan menu induk (tujuan tombol kembali). */
const PAGES: { href: string; title: string; parent: string }[] = [
  // Menu utama (bar bawah, sidebar, avatar profil) tanpa panah kembali: pindah menu lewat bar bawah/sidebar.
  // Panah kembali hanya di sub menu.
  { href: '/operation', title: 'Operation', parent: '' },
  { href: '/delivery', title: 'Delivery', parent: '' },
  { href: '/hsse', title: 'HSSE & Guard Patrol System', parent: '' },
  { href: '/finance', title: 'Finance', parent: '' },
  { href: '/laporan', title: 'Report', parent: '' },
  { href: '/profil', title: 'Profil', parent: '' },
  { href: '/input', title: 'Operation', parent: '' },
  { href: '/input/bongkar', title: 'Input Bongkaran', parent: '/operation' },
  { href: '/input/:id/lo/', title: 'Ubah Nomor LO', parent: '/input/bongkar' },
  { href: '/input/', title: 'Form Bongkaran', parent: '/input/bongkar' },
  { href: '/plan', title: 'Plan Pengiriman', parent: '/delivery' },
  { href: '/plan/baru', title: 'Permintaan Baru (MS2)', parent: '/plan' },
  { href: '/plan/so/', title: 'Edit SO & LO', parent: '/plan' },
  { href: '/kualitas', title: 'Kualitas Harian', parent: '/operation' },
  { href: '/kualitas/', title: 'Uji Kualitas Harian', parent: '/kualitas' },
  { href: '/sample', title: 'Kualitas Pasca Penerimaan', parent: '/operation' },
  { href: '/sample/', title: 'Uji Pasca Penerimaan', parent: '/sample' },
  { href: '/kaleng', title: 'Kaleng Sample', parent: '/operation' },
  { href: '/takaran', title: 'Uji Takaran', parent: '/operation' },
  { href: '/takaran/uji', title: 'Form Uji Takaran', parent: '/takaran' },
  { href: '/laporan/takaran', title: 'Riwayat Uji Takaran', parent: '/laporan/riwayat' },
  { href: '/totalizer', title: 'Totalizer', parent: '/operation' },
  { href: '/totalizer/', title: 'Form Totalizer', parent: '/totalizer' },
  { href: '/laporan/totalizer', title: 'Riwayat Totalizer', parent: '/laporan/riwayat' },
  { href: '/laporan/pump-test', title: 'Riwayat Pump Test', parent: '/laporan/riwayat' },
  { href: '/laporan/so', title: 'Laporan Stock Opname', parent: '/laporan' },
  { href: '/air', title: 'Water Content Tangki', parent: '/operation' },
  { href: '/air/', title: 'Form Water Content', parent: '/air' },
  { href: '/laporan/air', title: 'Riwayat Water Content', parent: '/laporan/riwayat' },
  { href: '/stok', title: 'Stok Awal Shift', parent: '/operation' },
  { href: '/stok/', title: 'Form Stok Awal', parent: '/stok' },
  // Setelah form dikirim: tanpa tombol kembali (ke Dashboard lewat tombol di halaman).
  { href: '/terkirim', title: 'Data Terkirim', parent: '' },
  { href: '/apar', title: 'APAR & APAB', parent: '/hsse' },
  { href: '/apar/inspeksi', title: 'Inspeksi APAR & APAB', parent: '/apar' },
  { href: '/apar/inspeksi/', title: 'Inspeksi Unit', parent: '/apar/inspeksi' },
  { href: '/apar/data', title: 'Data Utama APAR & APAB', parent: '/apar' },
  { href: '/apar/data/unit/', title: 'Unit APAR / APAB', parent: '/apar/data' },
  { href: '/apar/data/area', title: 'Tambah Area', parent: '/apar/data' },
  { href: '/apar/label', title: 'Label QR APAR & APAB', parent: '/apar' },
  { href: '/apar/unit/', title: 'Unit APAR / APAB', parent: '/apar' },
  { href: '/laporan/riwayat', title: 'Riwayat', parent: '/laporan' },
  { href: '/laporan/export', title: 'Export File', parent: '/laporan' },
  { href: '/laporan/persediaan', title: 'Catatan Persediaan BBM', parent: '/laporan/export' },
  { href: '/laporan/ba', title: 'Berita Acara', parent: '/laporan' },
  { href: '/laporan/bongkaran', title: 'Riwayat Pembongkaran MT', parent: '/laporan/riwayat' },
  { href: '/laporan/lo', title: 'Tracking LO', parent: '/delivery' },
  { href: '/laporan/kualitas', title: 'Riwayat Kualitas Harian', parent: '/laporan/riwayat' },
  { href: '/laporan/kualitas/', title: 'Detail Uji Kualitas', parent: '/laporan/kualitas' },
  { href: '/laporan/apar', title: 'Riwayat Inspeksi APAR', parent: '/laporan/riwayat' },
  { href: '/ops', title: 'Operasional SPBU', parent: '/operation' },
  { href: '/ops/kalender', title: 'Kalender Progres', parent: '/ops' },
  { href: '/grounding', title: 'Pengukuran Grounding', parent: '/hsse' },
  { href: '/grounding/', title: 'Form Pengukuran Grounding', parent: '/grounding' },
  { href: '/personil', title: 'Personil & Jadwal Shift', parent: '/operation' },
  { href: '/personil/jadwal', title: 'Jadwal Shift Bulanan', parent: '/personil' },
  { href: '/ops/', title: 'Form Operasional', parent: '/ops' },
  { href: '/laporan/ops', title: 'Laporan Operasional SPBU', parent: '/laporan/export' },
  { href: '/insiden/baru', title: 'Lapor Insiden & Near miss', parent: '/hsse' },
  { href: '/insiden/baru/', title: 'Form Laporan Kejadian', parent: '/insiden/baru' },
  { href: '/laporan/insiden', title: 'Riwayat Insiden & Near miss', parent: '/laporan/riwayat' },
  { href: '/lapor', title: 'Lapor Kejadian', parent: '/hsse' },
  { href: '/laporan/henti', title: 'Riwayat Pemberhentian Penyaluran', parent: '/laporan/riwayat' },
  { href: '/laporan/insiden/', title: 'Detail Laporan Kejadian', parent: '/laporan/insiden' },
  { href: '/patrol', title: 'Guard Patrol System', parent: '/hsse' },
  { href: '/finance/petty', title: 'Petty Cash', parent: '/finance' },
  { href: '/finance/closing', title: 'Closing Shift', parent: '/finance' },
  { href: '/finance/closing/', title: 'Closing Shift', parent: '/finance/closing' },
  { href: '/finance/petty/pengajuan/baru', title: 'Form Pengajuan Petty Cash', parent: '/finance/petty/pengajuan' },
  { href: '/finance/petty/pengajuan/', title: 'Detail Pengajuan', parent: '/finance/petty/pengajuan' },
  { href: '/finance/petty/pengajuan', title: 'Pengajuan Pengadaan & Reimburse', parent: '/finance/petty' },
  { href: '/finance/petty/realisasi/', title: 'Form Realisasi', parent: '/finance/petty/realisasi' },
  { href: '/finance/petty/realisasi', title: 'Realisasi Petty Cash', parent: '/finance' },
  { href: '/wbs', title: 'Whistleblowing System', parent: '/patrol' },
  { href: '/wbs/', title: 'Form Laporan WBS', parent: '/wbs' },
  { href: '/laporan/wbs', title: 'Laporan WBS', parent: '/laporan/riwayat' },
  { href: '/laporan/wbs/', title: 'Detail Laporan WBS', parent: '/laporan/wbs' },
  { href: '/gts/isi', title: 'Sampling Penyaluran Subsidi', parent: '/gts' },
  { href: '/gts', title: 'Sampling Penyaluran Subsidi', parent: '/patrol' },
  { href: '/laporan/gts', title: 'Riwayat Sampling Penyaluran Subsidi', parent: '/laporan/riwayat' },
  { href: '/kalkulator', title: 'Kalkulator', parent: '/profil' },
  { href: '/profil/sandi', title: 'Ganti Kata Sandi', parent: '/profil' },
  { href: '/pengaturan', title: 'Pengaturan SPBU', parent: '/profil' },
  { href: '/pengaturan/identitas', title: 'Identitas SPBU', parent: '/pengaturan' },
  { href: '/pengaturan/dispenser', title: 'Data Dispenser', parent: '/pengaturan' },
  { href: '/pengaturan/dispenser/', title: 'Form Dispenser', parent: '/pengaturan/dispenser' },
  { href: '/pengaturan/nozzle', title: 'Nozzle & Tera Metrologi', parent: '/pengaturan' },
  { href: '/pengaturan/nozzle/', title: 'Form Nozzle', parent: '/pengaturan/nozzle' },
  { href: '/pengaturan/sold-ship-to', title: 'Sold To & Ship To', parent: '/profil' },
  { href: '/pengaturan/aturan', title: 'Aturan Pemeriksaan', parent: '/pengaturan' },
  { href: '/pengaturan/acuan', title: 'Data Acuan', parent: '/pengaturan' },
  { href: '/anggota', title: 'Anggota SPBU', parent: '/profil' },
  { href: '/anggota/baru', title: 'Buat Akun Baru', parent: '/anggota' },
  { href: '/anggota/daftar', title: 'Daftarkan Akun', parent: '/anggota' },
  { href: '/anggota/sandi/', title: 'Atur Ulang Kata Sandi', parent: '/anggota' },
  { href: '/pengaturan/tangki', title: 'Database Tangki', parent: '/profil' },
  { href: '/pengaturan/tangki/', title: 'Tangki & Tabel Kalibrasi', parent: '/pengaturan/tangki' },
  { href: '/unit', title: 'Unit Bisnis', parent: '/' },
  { href: '/unit/baru', title: 'Tambah SPBU', parent: '/unit' },
  // Wajib sebelum modul lain dipakai: tanpa tombol kembali.
  { href: '/siapkan', title: 'Siapkan Data SPBU', parent: '' },
]

/** Cocokkan alamat: ":x" = satu segmen apa pun, akhiran "/" = semua halaman di bawahnya. */
function cocok(pola: string, pathname: string) {
  const prefix = pola.endsWith('/')
  const a = pola.replace(/\/$/, '').split('/')
  const b = pathname.split('/')
  if (prefix ? b.length <= a.length : b.length !== a.length) return false
  return a.every((seg, i) => seg.startsWith(':') || seg === b[i])
}

const pageFor = (pathname: string) => PAGES.find((p) => cocok(p.href, pathname))

/** true bila `pathname` berada di bawah `induk` menurut rantai menu induk (mis. form di bawah daftarnya). */
export function turunanDari(pathname: string, induk: string) {
  let p: string | null = pathname
  for (let i = 0; i < 12 && p; i++) {
    p = parentOf(p)
    if (p === induk) return true
  }
  return false
}

/** Tujuan tombol kembali di header, null untuk halaman grup menu. */
export function parentOf(pathname: string) {
  return pageFor(pathname)?.parent || null
}

export function titleFor(pathname: string) {
  return GRUP.find((g) => g.href === pathname)?.title ?? pageFor(pathname)?.title ?? 'FLOQ'
}
