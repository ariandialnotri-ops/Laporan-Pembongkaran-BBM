import { ChartNoAxesCombined, FileText, FlaskConical, Truck, UserRound, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  title: string
  icon: LucideIcon
  /** Rute lain yang termasuk menu ini (dock tetap menyala saat dibuka). */
  also?: string[]
}

/**
 * Lima menu, satu pekerjaan per menu: hari ini, bongkar mobil tangki,
 * uji Q&Q harian, laporan, akun. Isi yang berkaitan dipisah dengan sub-tab.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', title: 'HOME', icon: ChartNoAxesCombined },
  { href: '/input', label: 'Bongkar', title: 'Bongkaran', icon: Truck, also: ['/plan'] },
  { href: '/qq', label: 'Q&Q', title: 'Q&Q', icon: FlaskConical, also: ['/stok'] },
  { href: '/laporan', label: 'Laporan', title: 'Laporan', icon: FileText },
  { href: '/profil', label: 'Profil', title: 'Profil', icon: UserRound, also: ['/kalkulator', '/pengaturan', '/anggota'] },
]

export type SectionTab = {
  href: string
  label: string
  /** Satu kalimat: apa yang dikerjakan di sub-tab ini. */
  hint: string
}

/** Sub-tab tiap menu. Hanya tampil di rute yang tepat sama (bukan di form bongkaran). */
export const SECTION_TABS: SectionTab[][] = [
  [
    { href: '/input', label: 'Bongkaran', hint: 'Mulai saat mobil tangki tiba, atau lanjutkan bongkaran yang belum selesai.' },
    { href: '/plan', label: 'Plan SO & LO', hint: 'Catat permintaan MS2, lalu isi nomor SO, LO, dan segel saat terbit.' },
  ],
  [
    { href: '/qq', label: 'Ringkasan', hint: 'Hasil kualitas dan kuantitas terbaru tiap produk dan nozzle.' },
    { href: '/qq/uji', label: 'Uji Harian', hint: 'Catat density, suhu, dan tera bejana 20 L untuk shift ini.' },
    { href: '/stok', label: 'Stok Shift', hint: 'Isi stok awal tiap produk di awal shift, pengeluaran di akhir shift.' },
  ],
  [
    { href: '/laporan', label: 'Berita Acara', hint: 'Berita Acara tiap bongkaran: buka, tanda tangani, atau unduh.' },
    { href: '/laporan/persediaan', label: 'Persediaan BBM', hint: 'Catatan persediaan per produk, satu baris per shift.' },
  ],
]

export function sectionTabsFor(pathname: string) {
  return SECTION_TABS.find((tabs) => tabs.some((t) => t.href === pathname)) ?? null
}

/** Judul halaman yang tidak sama dengan menu induknya di dock. */
const EXTRA_TITLES: [string, string][] = [
  ['/plan', 'Bongkaran'],
  ['/stok', 'Q&Q'],
  ['/kalkulator', 'Kalkulator'],
  ['/pengaturan', 'Pengaturan SPBU'],
  ['/anggota', 'Anggota SPBU'],
]

export function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isNavActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((href) => isRouteActive(pathname, href))
}

export function titleFor(pathname: string) {
  const extra = EXTRA_TITLES.find(([href]) => isRouteActive(pathname, href))
  if (extra) return extra[1]
  return NAV_ITEMS.find((item) => isRouteActive(pathname, item.href))?.title ?? 'FLOQ'
}
