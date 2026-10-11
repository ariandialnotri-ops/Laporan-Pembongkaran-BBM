import { ChartNoAxesCombined, ClipboardPlus, FileText, UserRound, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  title: string
  icon: LucideIcon
}

/**
 * Empat menu dengan peran tegas: Dashboard hanya menampilkan data,
 * Input untuk semua pengisian, Laporan untuk semua riwayat & unduhan, Profil untuk akun & alat.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', title: 'Dashboard', icon: ChartNoAxesCombined },
  { href: '/input', label: 'Input', title: 'Input', icon: ClipboardPlus },
  { href: '/laporan', label: 'Laporan', title: 'Laporan', icon: FileText },
  { href: '/profil', label: 'Profil', title: 'Profil', icon: UserRound },
]

/** Halaman di bawah menu dock: judul header dan menu induk (tujuan tombol kembali). */
const PAGES: { href: string; title: string; parent: string }[] = [
  { href: '/input/bongkar', title: 'Input Bongkaran', parent: '/input' },
  { href: '/input/', title: 'Form Bongkaran', parent: '/input/bongkar' },
  { href: '/plan', title: 'Plan Pengiriman', parent: '/input' },
  { href: '/plan/so/', title: 'Edit SO & LO', parent: '/plan' },
  { href: '/kualitas', title: 'Kualitas Harian', parent: '/input' },
  { href: '/sample', title: 'Uji Pasca Penerimaan', parent: '/input' },
  { href: '/takaran', title: 'Uji Takaran', parent: '/input' },
  { href: '/laporan/takaran', title: 'Riwayat Uji Takaran', parent: '/laporan' },
  { href: '/stok', title: 'Stok Awal Shift', parent: '/input' },
  { href: '/apar', title: 'APAR & APAB', parent: '/input' },
  { href: '/apar/inspeksi', title: 'Inspeksi APAR & APAB', parent: '/apar' },
  { href: '/apar/inspeksi/', title: 'Inspeksi Unit', parent: '/apar/inspeksi' },
  { href: '/apar/data', title: 'Data Utama APAR & APAB', parent: '/apar' },
  { href: '/apar/data/unit/', title: 'Unit APAR / APAB', parent: '/apar/data' },
  { href: '/apar/label', title: 'Label QR APAR & APAB', parent: '/apar' },
  { href: '/apar/unit/', title: 'Unit APAR / APAB', parent: '/apar' },
  { href: '/laporan/persediaan', title: 'Catatan Persediaan BBM', parent: '/laporan' },
  { href: '/laporan/ba', title: 'Berita Acara', parent: '/laporan' },
  { href: '/laporan/bongkaran', title: 'Riwayat Pembongkaran MT', parent: '/laporan' },
  { href: '/laporan/lo', title: 'Riwayat Tracking LO', parent: '/laporan' },
  { href: '/laporan/kualitas', title: 'Riwayat Kualitas Harian', parent: '/laporan' },
  { href: '/laporan/kualitas/', title: 'Detail Uji Kualitas', parent: '/laporan/kualitas' },
  { href: '/laporan/tera', title: 'Riwayat Tera', parent: '/laporan' },
  { href: '/laporan/apar', title: 'Riwayat Inspeksi APAR', parent: '/laporan' },
  { href: '/insiden/baru', title: 'Lapor Insiden & Near miss', parent: '/input' },
  { href: '/laporan/insiden', title: 'Riwayat Insiden & Near miss', parent: '/laporan' },
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

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Menu dock yang menyala: menu itu sendiri atau menu induk halaman. */
export function activeNav(pathname: string): string {
  let p = pathname
  for (let i = 0; i < 4; i++) {
    if (NAV_ITEMS.some((n) => n.href === p)) return p
    const page = pageFor(p)
    if (!page) break
    p = page.parent
  }
  return NAV_ITEMS.find((n) => n.href !== '/' && isRouteActive(pathname, n.href))?.href ?? '/'
}

/** Tujuan tombol kembali di header, null untuk halaman menu dock. */
export function parentOf(pathname: string) {
  return pageFor(pathname)?.parent || null
}

export function titleFor(pathname: string) {
  return pageFor(pathname)?.title ?? NAV_ITEMS.find((item) => item.href === pathname)?.title ?? 'FLOQ'
}
