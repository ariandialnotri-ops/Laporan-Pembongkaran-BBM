/**
 * Struktur menu FLOQ per peruntukan: Dashboard, Operation, Delivery, HSSE, Finance, Report.
 * Satu sumber untuk sidebar, bar bawah, dan halaman ikhtisar tiap grup; item difilter
 * menurut hak akses peran (roles.ts) dan fasilitas SPBU.
 */
import {
  Ban,
  Banknote,
  Beaker,
  BookOpenCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Cylinder,
  Droplet,
  Droplets,
  FileDown,
  FileSpreadsheet,
  FileText,
  FireExtinguisher,
  FlaskConical,
  Fuel,
  Gauge,
  History,
  Megaphone,
  PiggyBank,
  ReceiptText,
  Route,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  TestTube,
  TestTubes,
  Truck,
  Users,
  Wallet,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useStokShift } from '@/components/bongkaran/stok-gate'
import { kondisiSemua, hasilCek } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { qqRecordId, type AparRecord } from '@/lib/daily'
import { todayIso } from '@/lib/date'
import { labelSlot, slotKini } from '@/lib/gts'
import { lewatBatas } from '@/lib/harian'
import { hentiDari } from '@/lib/insiden'
import { formTampil } from '@/lib/ops'
import { loStatus, planBesokKurang } from '@/lib/plan'
import { sampleMenunggu } from '@/lib/sample'
import { shiftLabel } from '@/lib/shift'
import { takarStatus } from '@/lib/takar'

export type GrupKey = 'dashboard' | 'operation' | 'delivery' | 'hsse' | 'finance' | 'report'

export interface ItemMenu {
  /** Tujuan tautan (boleh berisi query, mis. /ops?grup=lingkungan). */
  to: string
  /** Path untuk cek hak akses & penanda aktif. */
  path: string
  icon: LucideIcon
  title: string
  desc: string
  status: string
  /** Perlu dikerjakan: badge oranye. */
  badge?: number
  /** Informasi (sedang berjalan): badge hijau. */
  info?: number
}

export interface GrupMenu {
  key: GrupKey
  label: string
  /** Label ringkas untuk bar bawah (bila label panjang). */
  labelPendek?: string
  /** Halaman ikhtisar grup. */
  href: string
  icon: LucideIcon
  desc: string
  items: ItemMenu[]
  /** Fitur belum tersedia (Finance). */
  segera?: boolean
}

/** Menu untuk peran & SPBU aktif. Grup tanpa item yang boleh dibuka tidak ditampilkan. */
export function useMenu(): GrupMenu[] {
  const app = useApp()
  const stok = useStokShift()
  const s = app.settings
  const hariIni = todayIso()
  const bulan = `${hariIni.slice(0, 8)}01`

  const shiftNama = shiftLabel(stok.key.shift).split(' (')[0]
  const drafts = app.reports.filter((r) => r.status === 'draft').length
  const los = app.plans.flatMap((p) => p.los.map((lo) => loStatus(lo, app.usedLoIds)))
  const proses = los.filter((x) => x === 'proses').length
  const kirim = los.filter((x) => x === 'delivery').length
  const loAktif = app.plans.flatMap((p) => p.los).filter((lo) => !['closed', 'deleted'].includes(loStatus(lo, app.usedLoIds))).length
  const besok = planBesokKurang(app.plans)
  // Kualitas harian sekali sehari (shift 1, paling lambat 10:00).
  const diuji = app.daily.some((d) => d.kind === 'qq' && d.id === qqRecordId(hariIni, 1) && !!d.data.selesaiAt)
  const lewat10 = lewatBatas(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`)
  const sample = sampleMenunggu(app.reports)
  const unitApar = (s.apar?.length ?? 0) + (s.apab?.length ?? 0)
  const aparBelum = kondisiSemua(s, app.daily.filter((d): d is AparRecord => d.kind === 'apar'), stok.key.tanggal).filter((k) => !k.bulanIni).length
  const takarHariIni = app.daily.filter((d) => d.kind === 'takar' && d.tanggal === hariIni)
  const takarLewatHariIni = takarHariIni.filter((d) => d.kind === 'takar' && takarStatus(d.data.hasilMl) === 'lewat').length
  const insidenTerbuka = app.daily.filter((d) => d.kind === 'insiden' && d.data.jenis !== 'henti' && d.data.status !== 'selesai').length
  const hentiAktif = hentiDari(app.daily).filter((x) => !x.h.selesai)
  const baBulan = app.reports.filter((r) => r.status !== 'draft' && r.tanggal >= bulan)
  const ttdKurang = baBulan.filter((r) => r.ttdKurang?.length).length
  const aparTerakhir = app.daily.filter((d): d is AparRecord => d.kind === 'apar' && !!d.data.selesaiAt).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0]
  const temuanApar = aparTerakhir ? aparTerakhir.data.units.filter((u) => hasilCek(u).temuan.length).length : 0

  // Operasional SPBU: kartu perawatan & housekeeping di Operation, pantauan lingkungan di HSSE.
  const opsGrup = formTampil(app.role, s)
  const adaOpsOperasional = opsGrup.some((g) => g.judul !== 'Pantauan lingkungan')
  const adaOpsLingkungan = opsGrup.some((g) => g.judul === 'Pantauan lingkungan')

  const grup: GrupMenu[] = [
    { key: 'dashboard', label: 'Dashboard', href: '/', icon: ChartNoAxesCombined, desc: 'Ringkasan operasional SPBU', items: [] },
    {
      key: 'operation',
      label: 'Operation',
      href: '/operation',
      icon: Fuel,
      desc: 'Stok, totalizer, water content, bongkaran, kualitas BBM, uji takaran, perawatan & housekeeping',
      items: [
        {
          to: '/stok',
          path: '/stok',
          icon: Fuel,
          title: 'Stok Awal Shift',
          desc: 'Wajib setiap awal shift, per produk',
          status: stok.tanpaTangki ? 'Database tangki belum diisi' : stok.missing ? `${shiftNama} belum diisi` : `${shiftNama} terisi`,
          badge: !stok.tanpaTangki && stok.missing ? 1 : 0,
        },
        {
          to: '/input/bongkar',
          path: '/input/bongkar',
          icon: Truck,
          title: 'Input Bongkaran',
          desc: '14 tahap SOP saat mobil tangki tiba',
          status: drafts ? `${drafts} bongkaran belum selesai` : 'Tidak ada yang berjalan',
          info: drafts,
        },
        {
          to: '/kualitas',
          path: '/kualitas',
          icon: FlaskConical,
          title: 'Kualitas Harian',
          desc: 'Density & suhu per produk, sekali sehari (shift 1, maks. 10:00)',
          status: diuji ? 'Hari ini sudah diuji' : lewat10 ? 'Terlewat (batas 10:00)' : 'Belum diuji (batas 10:00)',
          badge: diuji ? 0 : 1,
        },
        {
          to: '/sample',
          path: '/sample',
          icon: TestTube,
          title: 'Kualitas Pasca Penerimaan',
          desc: 'Wajib setelah setiap penerimaan BBM',
          status: sample.length ? `${sample.length} penerimaan belum diuji` : 'Semua penerimaan sudah diuji',
          badge: sample.length,
        },
        {
          to: '/kaleng',
          path: '/kaleng',
          icon: Cylinder,
          title: 'Kaleng Sample',
          desc: 'Sample mobil tangki dari hasil pembongkaran, 3 terakhir per produk',
          status: `${app.reports.filter((r) => r.status === 'selesai').length} bongkaran selesai`,
        },
        {
          to: '/stop-penyaluran',
          path: '/stop-penyaluran',
          icon: Ban,
          title: 'Stop Penyaluran',
          desc: 'Lapor penghentian penyaluran produk, jam penyaluran kembali, dashboard lama berhenti',
          status: hentiAktif.length ? `Berhenti: ${[...new Set(hentiAktif.flatMap((x) => x.h.produk))].join(', ')}` : 'Semua produk tersalurkan normal',
          badge: hentiAktif.length,
        },
        {
          to: '/totalizer',
          path: '/totalizer',
          icon: Gauge,
          title: 'Totalizer',
          desc: 'Totalisator digital awal & akhir shift per nozzle dan produk',
          status: (s.nozzles ?? []).length ? `${(s.nozzles ?? []).length} nozzle · awal & akhir shift` : 'Database nozzle belum diisi',
        },
        {
          to: '/air',
          path: '/air',
          icon: Droplet,
          title: 'Water Content Tangki',
          desc: 'Pasta air di setiap tangki pendam, sekali sehari (shift 1, maks. 10:00)',
          status: stok.tanpaTangki ? 'Database tangki belum diisi' : 'Kolase foto + laporan WhatsApp',
        },
        {
          to: '/takaran',
          path: '/takaran',
          icon: Beaker,
          title: 'Uji Takaran',
          desc: 'Bejana 20 L per nozzle, opsi Preset & Manual',
          status: takarLewatHariIni ? `${takarLewatHariIni} hasil melebihi toleransi` : takarHariIni.length ? `${takarHariIni.length} hasil hari ini` : 'Belum ada uji hari ini',
          badge: takarLewatHariIni,
        },
        ...(adaOpsOperasional
          ? [
              {
                to: '/ops?grup=operasional',
                path: '/ops',
                icon: ClipboardCheck,
                title: app.role === 'cs' ? 'Checklist Housekeeping' : 'Perawatan & Housekeeping',
                desc: app.role === 'cs' ? 'Checklist kebersihan harian per area, jadwal pembersihan & kalender progres' : 'Kartu perawatan per tangki & peralatan, checklist housekeeping (diisi CS), jadwal & kalender progres',
                status: 'Format laporan operasional SPBU',
              },
            ]
          : []),
        {
          to: '/personil',
          path: '/personil',
          icon: Users,
          title: 'Personil & Jadwal Shift',
          desc: 'Daftar personil SPBU, jadwal shift bulanan, dan siapa yang sedang bertugas',
          status: (s.personil ?? []).filter((p) => p.aktif).length ? `${(s.personil ?? []).filter((p) => p.aktif).length} personil aktif` : 'Daftar personil belum diisi',
        },
      ],
    },
    {
      key: 'delivery',
      label: 'Delivery',
      href: '/delivery',
      icon: Route,
      desc: 'Plan pengiriman dan tracking SO & LO',
      items: [
        {
          to: '/plan',
          path: '/plan',
          icon: ClipboardList,
          title: 'Plan Pengiriman',
          desc: 'Permintaan MS2, nomor SO, dan LO per produk',
          status: besok ? 'Plan besok belum dibuat' : proses ? `${proses} LO belum terbit` : 'Semua LO terisi',
          badge: (besok ? 1 : 0) + proses,
        },
        {
          to: '/laporan/lo',
          path: '/laporan/lo',
          icon: Route,
          title: 'Tracking LO',
          desc: 'Status SO & LO dari plan sampai closed',
          status: kirim ? `${kirim} LO sedang dikirim` : `${loAktif} LO aktif`,
          info: kirim,
        },
      ],
    },
    {
      key: 'hsse',
      label: 'HSSE & Guard Patrol System',
      labelPendek: 'HSSE & Patrol',
      href: '/hsse',
      icon: ShieldCheck,
      desc: 'Proteksi kebakaran, insiden & near miss, pantauan lingkungan, guard patrol (sampling penyaluran subsidi, whistleblowing)',
      items: [
        {
          to: '/apar',
          path: '/apar',
          icon: FireExtinguisher,
          title: 'Inspeksi APAR & APAB',
          desc: 'Pindai QR di unit, checklist & foto',
          status: !unitApar ? 'Data utama unit belum diisi' : aparBelum ? `${aparBelum} dari ${unitApar} unit belum bulan ini` : 'Semua unit sudah bulan ini',
          badge: aparBelum,
        },
        {
          to: '/insiden/baru',
          path: '/insiden/baru',
          icon: ShieldAlert,
          title: 'Laporan Insiden & Near miss',
          desc: 'Insiden, near miss, dan kerusakan peralatan',
          status: insidenTerbuka ? `${insidenTerbuka} laporan belum selesai` : 'Tidak ada laporan terbuka',
          badge: insidenTerbuka,
        },
        {
          to: '/grounding',
          path: '/grounding',
          icon: Zap,
          title: 'Pengukuran Grounding',
          desc: 'Tahanan pentanahan tangki, dispenser, panel, penangkal petir & fasilitas (≤ 5 Ω)',
          status: 'Titik ukur otomatis dari data SPBU',
        },
        {
          to: '/patrol',
          path: '/patrol',
          icon: ScanEye,
          title: 'Guard Patrol System',
          desc: 'Sampling penyaluran subsidi dan whistleblowing system',
          status: app.can('/gts') ? `Slot sampling berjalan ${labelSlot(slotKini().slot)}` : 'Whistleblowing system',
        },
        ...(adaOpsLingkungan
          ? [
              {
                to: '/ops?grup=lingkungan',
                path: '/ops',
                icon: Waves,
                title: 'Sumur Pantau & Oil Catcher',
                desc: 'Pantauan lingkungan harian',
                status: 'Harian, foto bila ada temuan',
              },
            ]
          : []),
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      href: '/finance',
      icon: Wallet,
      desc: 'Closing shift (setoran tepat), petty cash: pengajuan pengadaan & reimburse, realisasi dengan akun COA dan voucher',
      items: [
        {
          to: '/finance/closing',
          path: '/finance/closing',
          icon: Banknote,
          title: 'Closing Shift',
          desc: 'Hitung buta setoran tiap akhir shift (format One Touch), penjualan dari totalizer, laporan WhatsApp',
          status: 'Kepala shift, setiap akhir shift',
        },
        {
          to: '/finance/petty',
          path: '/finance/petty',
          icon: PiggyBank,
          title: 'Petty Cash',
          desc: app.role === 'abh' ? 'Persetujuan akhir pengajuan pengadaan & reimburse' : 'Pengajuan pengadaan barang/jasa atau reimburse',
          status: 'Persetujuan Admin/Cashier lalu ABH',
        },
        ...(['admin', 'abh'].includes(app.role)
          ? [
              {
                to: '/finance/petty/realisasi',
                path: '/finance/petty/realisasi',
                icon: ReceiptText,
                title: 'Realisasi Petty Cash',
                desc: 'Admin/Cashier: pilih akun COA, catat nota, bayar reimburse, unduh voucher realisasi',
                status: 'Voucher per tanggal realisasi',
              },
            ]
          : []),
      ],
    },
    {
      key: 'report',
      label: 'Report',
      href: '/laporan',
      icon: FileText,
      desc: 'Riwayat, stock opname, export file, dan berita acara',
      items: [
        { to: '/laporan/riwayat', path: '/laporan/riwayat', icon: History, title: 'Riwayat', desc: 'Bongkaran, kualitas, APAR, uji takaran, insiden', status: insidenTerbuka + temuanApar ? `${insidenTerbuka + temuanApar} perlu ditindaklanjuti` : 'Semua sudah ditindaklanjuti', badge: insidenTerbuka + temuanApar },
        { to: '/laporan/so', path: '/laporan/so', icon: ClipboardList, title: 'Laporan Stock Opname', desc: 'BA Laporan Bulanan: SO tangki, totalisator, arus minyak, penerimaan, tera, cash opname', status: 'Excel BA per bulan' },
        { to: '/laporan/export', path: '/laporan/export', icon: FileDown, title: 'Export File', desc: 'Catatan persediaan BBM & laporan operasional (Excel)', status: 'Excel & PDF' },
        {
          to: '/laporan/ba',
          path: '/laporan/ba',
          icon: BookOpenCheck,
          title: 'Berita Acara',
          desc: 'BA pembongkaran dan tanda tangan',
          status: ttdKurang ? `${ttdKurang} menunggu tanda tangan` : `${baBulan.length} BA bulan ini`,
          badge: ttdKurang,
        },
      ],
    },
  ]

  return grup
    .map((g) => ({ ...g, items: g.items.filter((i) => app.can(i.path) && (i.path !== '/laporan/riwayat' || riwayatItems(app.can).length > 0)) }))
    .filter((g) => (g.key === 'dashboard' ? app.can('/') : g.items.length > 0))
}

/** HSSE > Guard Patrol System: sampling penyaluran subsidi (security) dan whistleblowing (semua peran). */
export function patrolItems(can: (p: string) => boolean): ItemMenu[] {
  const items: ItemMenu[] = [
    {
      to: '/gts',
      path: '/gts',
      icon: ScanEye,
      title: 'Sampling Penyaluran Subsidi',
      desc: 'Sampling JBT/JBKP tiap 2 jam: kolase foto EDC, struk, kendaraan + laporan WhatsApp',
      status: `Slot berjalan ${labelSlot(slotKini().slot)}`,
    },
    {
      to: '/wbs',
      path: '/wbs',
      icon: Megaphone,
      title: 'Whistleblowing System',
      desc: 'Laporkan pelanggaran secara rahasia',
      status: 'Hanya dibaca ABH, boleh anonim',
    },
  ]
  return items.filter((i) => can(i.path))
}

/** Halaman riwayat (Report > Riwayat). */
export function riwayatItems(can: (p: string) => boolean) {
  return RIWAYAT.filter((r) => can(r.path))
}

const RIWAYAT: { path: string; icon: LucideIcon; title: string; desc: string }[] = [
  { path: '/laporan/bongkaran', icon: Truck, title: 'Riwayat Pembongkaran MT', desc: 'Nopol, volume, gain/loss, status' },
  { path: '/laporan/kualitas', icon: FlaskConical, title: 'Riwayat Kualitas Harian', desc: 'Uji harian dan uji pasca penerimaan' },
  { path: '/laporan/totalizer', icon: Gauge, title: 'Riwayat Totalizer', desc: 'Totalisator digital per shift, penjualan per produk & nozzle' },
  { path: '/laporan/air', icon: Droplet, title: 'Riwayat Water Content', desc: 'Air di dasar tangki pendam, sekali sehari (shift 1, maks. 10:00), tindakan' },
  { path: '/laporan/apar', icon: FireExtinguisher, title: 'Riwayat Inspeksi APAR', desc: 'APAR, APAR cadangan, dan APAB' },
  { path: '/laporan/pump-test', icon: TestTubes, title: 'Riwayat Pump Test', desc: 'Pump test uji kualitas, uji kuantitas & uji takaran per nozzle dan produk' },
  { path: '/laporan/takaran', icon: Beaker, title: 'Riwayat Uji Takaran', desc: 'Bejana 20 L per nozzle, foto bercap waktu' },
  { path: '/laporan/insiden', icon: ShieldAlert, title: 'Riwayat Insiden & Near miss', desc: 'Insiden, near miss, kerusakan, dan tindak lanjut' },
  { path: '/laporan/henti', icon: Ban, title: 'Riwayat Stop Penyaluran', desc: 'Produk yang dihentikan sementara, jam berhenti sampai penyaluran kembali, lama berhenti' },
  { path: '/laporan/gts', icon: ScanEye, title: 'Riwayat Sampling Penyaluran Subsidi', desc: 'Guard patrol: sampling JBT/JBKP per slot 2 jam, isian & kirim ulang teks WhatsApp' },
  { path: '/laporan/wbs', icon: Megaphone, title: 'Laporan WBS', desc: 'Whistleblowing system: rahasia, khusus ABH' },
  { path: '/laporan/lo', icon: Route, title: 'Riwayat Tracking LO', desc: 'Status SO & LO dari plan sampai closed' },
  { path: '/grounding', icon: Zap, title: 'Riwayat Pengukuran Grounding', desc: 'Tahanan pentanahan per titik, titik di atas batas & tindak lanjut' },
]

/** File yang dapat diunduh (Report > Export File). */
export const EXPORT: { path: string; icon: LucideIcon; title: string; desc: string }[] = [
  { path: '/laporan/persediaan', icon: FileSpreadsheet, title: 'Catatan Persediaan BBM', desc: 'Per produk, satu baris per shift · Excel atau PDF' },
  { path: '/laporan/ops', icon: Droplets, title: 'Laporan Operasional SPBU', desc: 'Kartu perawatan, housekeeping, sumur pantau, oil catcher, breakdown · Excel format asli & PDF' },
]
