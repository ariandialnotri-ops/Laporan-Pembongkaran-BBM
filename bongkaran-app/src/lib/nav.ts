/**
 * Judul header dan menu induk (tujuan tombol kembali) tiap halaman. Menu dikelompokkan per
 * peruntukan: Dashboard, Operation, Delivery, HSSE, Finance, Report (lihat components/shell/menu-data.ts).
 */
const GRUP: { href: string; title: string }[] = [
  { href: '/', title: 'Dashboard' },
  { href: '/operation', title: 'Operation' },
  { href: '/delivery', title: 'Delivery' },
  { href: '/hsse', title: 'HSSE' },
  { href: '/finance', title: 'Finance' },
  { href: '/laporan', title: 'Report' },
  { href: '/profil', title: 'Profil' },
]

/** Halaman di bawah grup menu: judul header dan menu induk (tujuan tombol kembali). */
const PAGES: { href: string; title: string; parent: string }[] = [
  { href: '/input', title: 'Operation', parent: '' },
  { href: '/input/bongkar', title: 'Input Bongkaran', parent: '/operation' },
  { href: '/input/', title: 'Form Bongkaran', parent: '/input/bongkar' },
  { href: '/plan', title: 'Plan Pengiriman', parent: '/delivery' },
  { href: '/plan/so/', title: 'Edit SO & LO', parent: '/plan' },
  { href: '/kualitas', title: 'Kualitas Harian', parent: '/operation' },
  { href: '/sample', title: 'Kualitas Pasca Penerimaan', parent: '/operation' },
  { href: '/kaleng', title: 'Kaleng Sample', parent: '/operation' },
  { href: '/takaran', title: 'Uji Takaran', parent: '/operation' },
  { href: '/laporan/takaran', title: 'Riwayat Uji Takaran', parent: '/laporan/riwayat' },
  { href: '/stok', title: 'Stok Awal Shift', parent: '/operation' },
  { href: '/apar', title: 'APAR & APAB', parent: '/hsse' },
  { href: '/apar/inspeksi', title: 'Inspeksi APAR & APAB', parent: '/apar' },
  { href: '/apar/inspeksi/', title: 'Inspeksi Unit', parent: '/apar/inspeksi' },
  { href: '/apar/data', title: 'Data Utama APAR & APAB', parent: '/apar' },
  { href: '/apar/data/unit/', title: 'Unit APAR / APAB', parent: '/apar/data' },
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
  { href: '/ops/', title: 'Form Operasional', parent: '/ops' },
  { href: '/laporan/ops', title: 'Laporan Operasional SPBU', parent: '/laporan/export' },
  { href: '/insiden/baru', title: 'Lapor Insiden & Near miss', parent: '/hsse' },
  { href: '/laporan/insiden', title: 'Riwayat Insiden & Near miss', parent: '/laporan/riwayat' },
  { href: '/laporan/insiden/', title: 'Detail Laporan Kejadian', parent: '/laporan/insiden' },
  { href: '/kalkulator', title: 'Kalkulator', parent: '/profil' },
  { href: '/pengaturan', title: 'Pengaturan SPBU', parent: '/profil' },
  { href: '/pengaturan/identitas', title: 'Identitas SPBU', parent: '/pengaturan' },
  { href: '/pengaturan/dispenser', title: 'Data Dispenser', parent: '/pengaturan' },
  { href: '/pengaturan/nozzle', title: 'Nozzle & Tera Metrologi', parent: '/pengaturan' },
  { href: '/pengaturan/sold-ship-to', title: 'Sold To & Ship To', parent: '/profil' },
  { href: '/pengaturan/aturan', title: 'Aturan Pemeriksaan', parent: '/pengaturan' },
  { href: '/pengaturan/acuan', title: 'Data Acuan', parent: '/pengaturan' },
  { href: '/anggota', title: 'Anggota SPBU', parent: '/profil' },
  { href: '/pengaturan/tangki', title: 'Database Tangki', parent: '/profil' },
  { href: '/pengaturan/tangki/', title: 'Tangki & Tabel Kalibrasi', parent: '/pengaturan/tangki' },
  { href: '/unit', title: 'Unit Bisnis', parent: '/' },
  // Wajib sebelum modul lain dipakai: tanpa tombol kembali.
  { href: '/siapkan', title: 'Siapkan Data SPBU', parent: '' },
]

const pageFor = (pathname: string) => PAGES.find((p) => (p.href.endsWith('/') ? pathname.startsWith(p.href) : pathname === p.href))

/** Tujuan tombol kembali di header, null untuk halaman grup menu. */
export function parentOf(pathname: string) {
  return pageFor(pathname)?.parent || null
}

export function titleFor(pathname: string) {
  return GRUP.find((g) => g.href === pathname)?.title ?? pageFor(pathname)?.title ?? 'FLOQ'
}
