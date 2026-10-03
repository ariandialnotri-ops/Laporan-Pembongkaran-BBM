import { ClipboardList, FileSpreadsheet, FileText, FlaskConical, Ruler, Truck } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { MenuCard, type MenuItem } from '@/components/bongkaran/menu-card'
import { useApp } from '@/lib/app-state'
import { bejanaStatus, type QqRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { loStatus } from '@/lib/plan'

/** Menu Laporan: semua riwayat dan unduhan, satu kartu per jenis laporan. */
export function LaporanMenu() {
  const app = useApp()
  if (!app.loaded) return <Loading />

  const bulan = `${todayIso().slice(0, 8)}01`
  const pekan = todayIso(addDays(new Date(), -6))
  const baBulan = app.reports.filter((r) => r.status !== 'draft' && r.tanggal >= bulan)
  const ttdKurang = baBulan.filter((r) => r.ttdKurang?.length).length
  const loAktif = app.plans.flatMap((p) => p.los).filter((lo) => !['closed', 'deleted'].includes(loStatus(lo, app.usedLoIds))).length
  const qq = app.daily.filter((d): d is QqRecord => d.kind === 'qq' && d.tanggal >= pekan)
  const ujiKualitas = qq.reduce((n, r) => n + r.data.kualitas.length, 0)
  // Hasil tera terakhir per nozzle yang di bawah batas.
  const terakhir = new Map<string, string>()
  app.daily
    .filter((d): d is QqRecord => d.kind === 'qq')
    .sort((a, b) => (a.tanggal + a.shift).localeCompare(b.tanggal + b.shift))
    .forEach((r) => r.data.kuantitas.forEach((n) => n.selisihMl.trim() && terakhir.set(n.nozzleId || n.nozzle, n.selisihMl)))
  const lewat = [...terakhir.values()].filter((v) => bejanaStatus(v) === 'lewat').length

  const menus: MenuItem[] = [
    { to: '/laporan/persediaan', icon: FileSpreadsheet, title: 'Catatan Persediaan BBM', desc: 'Per produk, satu baris per shift', status: 'Unduh Excel atau PDF' },
    {
      to: '/laporan/ba',
      icon: FileText,
      title: 'Berita Acara',
      desc: 'BA pembongkaran dan tanda tangan',
      status: ttdKurang ? `${ttdKurang} menunggu tanda tangan` : `${baBulan.length} BA bulan ini`,
      badge: ttdKurang,
    },
    { to: '/laporan/bongkaran', icon: Truck, title: 'Riwayat Pembongkaran MT', desc: 'Nopol, volume, gain/loss, status', status: `${app.reports.filter((r) => r.tanggal >= bulan).length} bongkaran bulan ini` },
    { to: '/laporan/lo', icon: ClipboardList, title: 'Riwayat Tracking LO', desc: 'Status SO & LO dari plan sampai closed', status: `${loAktif} LO aktif` },
    { to: '/laporan/kualitas', icon: FlaskConical, title: 'Riwayat Kualitas Harian', desc: 'Uji harian dan sample BBM 2 jam', status: `${ujiKualitas} uji 7 hari terakhir` },
    {
      to: '/laporan/tera',
      icon: Ruler,
      title: 'Riwayat Tera',
      desc: 'Bejana 20 L per nozzle',
      status: lewat ? `${lewat} nozzle di bawah batas` : 'Semua nozzle dalam batas',
      badge: lewat,
    },
  ]

  return (
    <nav aria-label="Menu laporan" className="grid grid-cols-2 gap-space-sm lg:grid-cols-3">
      {menus.map((m, i) => (
        <MenuCard key={m.to} m={m} index={i} />
      ))}
    </nav>
  )
}
