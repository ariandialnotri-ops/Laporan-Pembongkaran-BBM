import { ChartNoAxesCombined, ClipboardPlus, FileText, UserRound, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  title: string
  icon: LucideIcon
}

/** Four docks, like Tepat Setoran. Five would crowd the floating bar. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', title: 'Beranda Bongkaran', icon: ChartNoAxesCombined },
  { href: '/input', label: 'Input', title: 'Input Bongkaran & Q&Q', icon: ClipboardPlus },
  { href: '/laporan', label: 'Laporan', title: 'Laporan & Berita Acara', icon: FileText },
  { href: '/profil', label: 'Profil', title: 'Profil Pengguna', icon: UserRound },
]

/** Halaman di luar dock, dibuka dari Beranda dan Profil. */
const EXTRA_TITLES: [string, string][] = [
  ['/plan', 'Plan Kirim'],
  ['/kalkulator', 'Kalkulator'],
  ['/pengaturan', 'Pengaturan SPBU'],
  ['/anggota', 'Anggota SPBU'],
]

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function titleFor(pathname: string) {
  const extra = EXTRA_TITLES.find(([href]) => isRouteActive(pathname, href))
  if (extra) return extra[1]
  return NAV_ITEMS.find((item) => isRouteActive(pathname, item.href))?.title ?? 'Bongkaran BBM'
}
