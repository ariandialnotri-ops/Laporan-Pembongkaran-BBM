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
  { href: '/stok', title: 'Stok Awal Shift', parent: '/input' },
  { href: '/apar', title: 'APAR & APAB', parent: '/input' },
  { href: '/apar/inspeksi', title: 'Inspeksi APAR & APAB', parent: '/apar' },
  { href: '/apar/data', title: 'Data Utama APAR & APAB', parent: '/apar' },
  { href: '/apar/label', title: 'Label QR APAR & APAB', parent: '/apar' },
  { href: '/apar/unit/', title: 'Unit APAR / APAB', parent: '/apar' },
  { href: '/laporan/persediaan', title: 'Catatan Persediaan BBM', parent: '/laporan' },
  { href: '/laporan/ba', title: 'Berita Acara', parent: '/laporan' },
  { href: '/laporan/bongkaran', title: 'Riwayat Pembongkaran MT', parent: '/laporan' },
  { href: '/laporan/lo', title: 'Riwayat Tracking LO', parent: '/laporan' },
  { href: '/laporan/kualitas', title: 'Riwayat Kualitas Harian', parent: '/laporan' },
  { href: '/laporan/tera', title: 'Riwayat Tera', parent: '/laporan' },
  { href: '/laporan/apar', title: 'Riwayat Inspeksi APAR', parent: '/laporan' },
  { href: '/kalkulator', title: 'Kalkulator', parent: '/profil' },
  { href: '/pengaturan', title: 'Pengaturan SPBU', parent: '/profil' },
  { href: '/anggota', title: 'Anggota SPBU', parent: '/profil' },
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
  return pageFor(pathname)?.parent ?? null
}

export function titleFor(pathname: string) {
  return pageFor(pathname)?.title ?? NAV_ITEMS.find((item) => item.href === pathname)?.title ?? 'FLOQ'
}
