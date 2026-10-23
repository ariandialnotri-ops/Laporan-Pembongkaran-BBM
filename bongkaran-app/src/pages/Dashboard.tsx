import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Beaker,
  Building2,
  BrushCleaning,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Ellipsis,
  FireExtinguisher,
  FlaskConical,
  Fuel,
  Gauge,
  Minus,
  Network,
  ScanEye,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { ArsipFotoBanner } from '@/components/bongkaran/arsip-foto'
import { DateFilter, inRange, presetLabel, useDateRange } from '@/components/bongkaran/date-filter'
import { KalengSample } from '@/components/bongkaran/kaleng-sample'
import { KualitasHighlight, kunciHarian } from '@/components/bongkaran/kualitas-highlight'
import { TangkiBelumAda } from '@/components/bongkaran/stok-gate'
import { KartuStopPenyaluran } from '@/components/insiden/henti'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { buttonVariants } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { KpiOperation } from '@/components/dashboard/kpi-highlight'
import { BarChart, KATEGORI, warnaProduk } from '@/components/dashboard/charts'
import { periodeSebelum } from '@/lib/kpi'
import { kelompokPeriode, periodeDari, PilihPeriode, type PeriodeDashboard } from '@/components/dashboard/periode'
import { Sheet } from '@/components/ui/sheet'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { kondisiSemua } from '@/lib/apar'
import { berlakuSertifikat, statusSertifikat } from '@/lib/berlaku'
import { qqD15, type AparRecord, type QqKualitas, type QqRecord, type TakarRecord } from '@/lib/daily'
import { addDays, formatTanggalIso, formatTanggalPanjang, formatTanggalSingkat, isoWeek, startOfWeek, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { LO_STATUS, loStatus, loStatusMeta, planBesokKurang, planSupply, type LoDisplayStatus } from '@/lib/plan'
import { produkMeta } from '@/lib/produk'
import { formatMl, opsiLabel, takarStatus } from '@/lib/takar'
import { acuanD15, detailTanggal, kalenderMinggu, labelQQ, qqOf, type CalendarDay } from '@/lib/ringkasan'
import { currentShift, shiftLabel } from '@/lib/shift'
import { formatDurasi, rataRata, slaOf } from '@/lib/sla'
import { PRODUK_OPTIONS, STEPS, type ReportSummary } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Status LO yang diringkas di kartu Status Alur LO; Alih Supply & Deleted ada di riwayat. */
const LO_DASH: { key: LoDisplayStatus; sub: string; tile: string; teks: string }[] = [
  { key: 'proses', sub: 'Menunggu depot', tile: 'bg-surface-container-low', teks: 'text-on-surface-variant' },
  { key: 'os', sub: 'Outstanding depot', tile: 'bg-amber-50', teks: 'text-amber-700' },
  { key: 'planned', sub: 'Antri MT', tile: 'bg-primary-fixed/50', teks: 'text-primary' },
  { key: 'delivery', sub: 'MT menuju SPBU', tile: 'bg-sky-50', teks: 'text-sky-700' },
  { key: 'delivered', sub: 'Sedang dibongkar', tile: 'bg-tertiary-fixed/40', teks: 'text-tertiary' },
  { key: 'closed', sub: 'Bongkar selesai', tile: 'bg-emerald-50', teks: 'text-emerald-700' },
]

const BULAN_SINGKAT = (d: Date) => d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })

/**
 * Dashboard hanya menampilkan data: status operasional, kalender pekan,
 * bongkaran, rencana vs realisasi, kualitas harian, kaleng sample, dan alur LO.
 * Semua pengisian ada di menu Input, semua riwayat di menu Laporan.
 * Cleaning Service dan Security memakai dashboard sesuai peruntukannya (DashboardPeran).
 */
export function Dashboard() {
  const app = useApp()
  const pilihan = pilihanDashboard(app.role)
  const [pilih, setPilih] = useState<JenisDashboard>(() => {
    try {
      const x = localStorage.getItem('floq:dashboard') as JenisDashboard | null
      return x && pilihan.some((p) => p.value === x) ? x : pilihan[0].value
    } catch {
      return pilihan[0].value
    }
  })
  // Periode tarikan dashboard (grafik & KPI); bawaan bulan berjalan.
  const [periode, setPeriode] = useState<PeriodeDashboard>(() => periodeDari('bulan'))
  const aktif = pilihan.some((p) => p.value === pilih) ? pilih : pilihan[0].value
  const ganti = (v: JenisDashboard) => {
    setPilih(v)
    try {
      localStorage.setItem('floq:dashboard', v)
    } catch {
      // abaikan: pilihan hanya kenyamanan per perangkat
    }
  }
  const pakaiPeriode = aktif === 'operation' || aktif === 'sales' || aktif === 'hsse'
  return (
    <div className="flex flex-col gap-space-md">
      <HeroDashboard>{pilihan.length > 1 && <PilihDashboard pilihan={pilihan} value={aktif} onChange={ganti} />}</HeroDashboard>
      {pakaiPeriode && (
        <div className="animate-entrance-1 flex items-center justify-between gap-space-sm px-space-xs">
          <span className="flex min-w-0 flex-col">
            <span className="text-headline-md font-bold text-on-surface">{pilihan.find((p) => p.value === aktif)?.label}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{pilihan.find((p) => p.value === aktif)?.sub}</span>
          </span>
          <PilihPeriode value={periode} onChange={setPeriode} className="shrink-0" />
        </div>
      )}
      <Suspense fallback={<Loading />}>
        {aktif === 'cs' ? <DashboardCs /> : aktif === 'security' ? <DashboardSecurity /> : aktif === 'hsse' ? <DashboardHsse periode={periode} /> : aktif === 'sales' ? <DashboardSales periode={periode} /> : <DashboardUtama periode={periode} />}
      </Suspense>
    </div>
  )
}

type JenisDashboard = 'operation' | 'sales' | 'hsse' | 'cs' | 'security'
type PilihanDashboard = { value: JenisDashboard; label: string; sub: string; icon: LucideIcon; nada: string }
/**
 * Dashboard yang dapat dipilih per peran: ABH semua (Operation, Sales/Finance, HSSE & Guard Patrol); pengawas &
 * kepala shift tanpa Sales/Finance; Admin/Cashier Sales/Finance; Security & Cleaning Service sesuai tugasnya.
 */
function pilihanDashboard(role: string | null): PilihanDashboard[] {
  const op: PilihanDashboard = { value: 'operation', label: 'Operation', sub: 'Bongkaran, kualitas, stok & perawatan', icon: Fuel, nada: 'from-[#0050cb] to-[#2a78d6]' }
  const sales: PilihanDashboard = { value: 'sales', label: 'Sales & Finance', sub: 'Penjualan, closing & petty cash', icon: TrendingUp, nada: 'from-[#00694a] to-[#1baf7a]' }
  const hsse: PilihanDashboard = { value: 'hsse', label: 'HSSE & Patrol', sub: 'APAR, insiden, guard tour & stop penyaluran', icon: ShieldCheck, nada: 'from-[#9a3412] to-[#eb6834]' }
  if (role === 'abh') return [op, sales, hsse]
  if (role === 'admin') return [sales]
  if (role === 'security') return [{ value: 'security', label: 'Security', sub: 'Guard tour, bongkaran & LO', icon: ScanEye, nada: 'from-[#3b2a9e] to-[#6250d6]' }, hsse]
  if (role === 'cs') return [{ value: 'cs', label: 'Housekeeping', sub: 'Progres & kepatuhan kebersihan', icon: BrushCleaning, nada: 'from-[#00694a] to-[#1baf7a]' }]
  return [op, hsse]
}

/**
 * Lanjutan header biru di halaman Dashboard (gaya beranda aplikasi HP): tanggal & shift, unit bisnis (ABH), lalu pemilih
 * dashboard di atas latar biru. Di HP menempel ke header dan selebar layar; di laptop menjadi panel membulat.
 */
function HeroDashboard({ children }: { children: ReactNode }) {
  const app = useApp()
  const now = new Date()
  const shift = currentShift(now)
  return (
    <div className="relative -mx-margin -mt-space-md overflow-hidden rounded-b-[28px] bg-gradient-to-b from-[#0047b8] to-[#1f6ad8] px-margin pb-space-md pt-space-sm text-white shadow-[0_12px_28px_-14px_rgba(0,71,184,0.6)] lg:mx-0 lg:mt-0 lg:rounded-3xl lg:pt-space-md">
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/[0.07]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-white/[0.05]" />
      <div className="relative flex flex-col gap-space-sm">
        {/* Tanggal operasional & shift berjalan (nama SPBU sudah di header). */}
        <div className="flex items-center justify-between gap-space-sm">
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Operasional SPBU</span>
            <span className="truncate text-body-lg font-bold leading-tight" title={formatTanggalPanjang(now)}>
              {formatTanggalPanjang(now).split(', ')[0]}, {formatTanggalSingkat(now)}
            </span>
          </span>
          <span className="tabular flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-white/20">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />
            {shiftLabel(shift.shift)}
          </span>
        </div>
        {/* ABH: unit bisnis (progres semua SPBU, tambah & ganti SPBU aktif). */}
        {app.isAdmin && (
          <Link to="/unit" className="flex min-h-12 items-center gap-space-sm rounded-2xl bg-white/10 px-space-sm py-2 ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15 active:scale-[0.99]">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Building2 className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-sm font-bold leading-tight">Unit bisnis · {app.spbuList.length} SPBU</span>
              <span className="truncate text-xs text-white/75">Progres semua SPBU, tambah & ganti SPBU aktif</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-white/80" />
          </Link>
        )}
        {children}
      </div>
    </div>
  )
}

/** Pemilih dashboard di atas latar biru: kartu kaca; yang aktif menjadi kartu putih dengan ikon bergradasi. */
function PilihDashboard({ pilihan, value, onChange }: { pilihan: PilihanDashboard[]; value: JenisDashboard; onChange: (v: JenisDashboard) => void }) {
  return (
    <div role="tablist" aria-label="Pilih dashboard" className="-mx-margin flex snap-x scroll-px-margin gap-space-sm overflow-x-auto px-margin py-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
      {pilihan.map((p) => {
        const on = p.value === value
        const Ikon = p.icon
        return (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={(e) => {
              onChange(p.value)
              e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }}
            className={cn(
              'relative flex min-h-[4.5rem] w-[11.5rem] shrink-0 snap-start items-center gap-space-sm rounded-2xl p-space-sm text-left transition-all duration-300 active:scale-[0.97] lg:w-auto',
              on ? 'bg-white text-on-surface shadow-[0_10px_24px_-10px_rgba(0,20,60,0.55)]' : 'bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15',
            )}
          >
            <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors', on ? `bg-gradient-to-br ${p.nada} text-white shadow-md` : 'bg-white/15 text-white')}>
              <Ikon className="size-[22px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-md font-bold leading-tight">{p.label}</span>
              <span className={cn('line-clamp-2 text-xs leading-snug', on ? 'text-on-surface-variant' : 'text-white/75')}>{p.sub}</span>
            </span>
            {on && <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

const DashboardHsse = lazy(() => import('@/pages/DashboardModul').then((m) => ({ default: m.DashboardHsse })))
const DashboardSales = lazy(() => import('@/pages/DashboardModul').then((m) => ({ default: m.DashboardSales })))

const DashboardCs = lazy(() => import('@/pages/DashboardPeran').then((m) => ({ default: m.DashboardCs })))
const DashboardSecurity = lazy(() => import('@/pages/DashboardPeran').then((m) => ({ default: m.DashboardSecurity })))

function DashboardUtama({ periode: periodeDash }: { periode: PeriodeDashboard }) {
  const app = useApp()
  const now = new Date()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [hari, setHari] = useState<string | null>(null)
  const [range, setRange] = useDateRange('today')
  const [filter, setFilter] = useState(false)
  const [buka, setBuka] = useState<string | null>(null)
  const [ujiKunci, setUjiKunci] = useState<string | null>(null)
  const [lihatBelum, setLihatBelum] = useState(false)

  // Uji kualitas harian terakhir tiap produk.
  const harian = useMemo(() => {
    const m = new Map<string, { k: QqKualitas; rec: QqRecord }>()
    app.daily
      .filter((d): d is QqRecord => d.kind === 'qq')
      .sort((a, b) => (a.tanggal + a.shift + a.data.jam).localeCompare(b.tanggal + b.shift + b.data.jam))
      .forEach((rec) => rec.data.kualitas.forEach((k) => k.produk && qqD15(k).d15 && m.set(k.produk, { k, rec })))
    return m
  }, [app.daily])
  // Produk yang belum pernah diuji diringkas satu baris (dibuka bila diketuk).
  const belumUji = PRODUK_OPTIONS.filter((p) => !harian.has(p))

  const loCounts = useMemo(() => {
    const c = new Map<LoDisplayStatus, number>()
    app.plans.forEach((p) =>
      p.los.forEach((lo) => {
        const k = loStatus(lo, app.usedLoIds)
        c.set(k, (c.get(k) ?? 0) + 1)
      }),
    )
    return c
  }, [app.plans, app.usedLoIds])

  useSyncOnOpen()
  if (!app.loaded) return <Loading />

  const hariIni = todayIso(now)
  const teraMasalah = (app.settings.nozzles ?? []).filter((n) => ['lewat', 'segera'].includes(statusSertifikat(n.teraTanggal, hariIni)))
  const calendarWeek = kalenderMinggu(app.reports, weekAnchor, app.daily, now)
  const planDates = new Set(app.plans.filter((p) => p.los.some((lo) => lo.status !== 'deleted')).map((p) => p.tanggal))
  const senin = startOfWeek(weekAnchor)
  const thisWeek = todayIso(senin) === todayIso(startOfWeek(now))

  const periode = app.reports.filter((r) => r.status === 'selesai' && inRange(r.tanggal, range))
  const sum = (rs: ReportSummary[], f: (r: ReportSummary) => number | null | undefined) => rs.reduce((n, r) => n + (f(r) ?? 0), 0)
  const perProduk = PRODUK_OPTIONS.map((p) => {
    const rs = periode.filter((r) => r.produk === p).sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam))
    const liter = sum(rs, (r) => r.volumeDO)
    const discharge = sum(rs, (r) => r.gainLoss)
    const transport = sum(rs, (r) => r.transportLoss)
    return { produk: p, rs, mt: rs.length, liter, transport, discharge, pctT: liter ? (transport / liter) * 100 : null, pct: liter ? (discharge / liter) * 100 : null }
  }).filter((x) => x.mt > 0)
  const total = {
    liter: sum(periode, (r) => r.volumeDO),
    transport: sum(periode, (r) => r.transportLoss),
    discharge: sum(periode, (r) => r.gainLoss),
  }
  const sla = periode.map((r) => slaOf(r, app.plans))
  const waktuKirim = sla.map((x) => x.permintaan).filter((m): m is number => m !== null)
  const waktuTempuh = sla.map((x) => x.perjalanan).filter((m): m is number => m !== null)

  // Rencana vs realisasi hari ini per produk: volume plan vs yang sudah dibongkar.
  const losHariIni = app.plans.filter((pl) => pl.tanggal === hariIni).flatMap((pl) => pl.los.filter((lo) => loStatus(lo, app.usedLoIds) !== 'deleted'))
  const planHariIni = PRODUK_OPTIONS.map((p) => {
    const los = losHariIni.filter((lo) => lo.produk === p)
    const vol = (st: LoDisplayStatus[]) => los.filter((lo) => st.includes(loStatus(lo, app.usedLoIds)))
    const selesai = vol(['closed'])
    const jalan = vol(['delivery', 'delivered'])
    return {
      produk: p,
      lo: los.length,
      volume: los.reduce((n, lo) => n + lo.volume, 0),
      selesai: selesai.length,
      volSelesai: selesai.reduce((n, lo) => n + lo.volume, 0),
      jalan: jalan.length,
      volJalan: jalan.reduce((n, lo) => n + lo.volume, 0),
    }
  }).filter((x) => x.lo > 0)
  const targetHariIni = planHariIni.reduce((n, x) => n + x.volume, 0)
  const loSelesaiHariIni = planHariIni.reduce((n, x) => n + x.selesai, 0)
  const tol = app.rules.densityTolerance + 1e-9
  const loTotal = LO_DASH.reduce((n, x) => n + (loCounts.get(x.key) ?? 0), 0)
  const isToday = range.preset === 'today'

  return (
    <div className="flex flex-col gap-space-md">
      <ArsipFotoBanner />
      <TangkiBelumAda className="animate-entrance-1" />
      {/* Highlight KPI bulan berjalan (lib/kpi.ts, docs/KPI.md). */}
      <KpiOperation periode={periodeDash} className="animate-entrance-1" />
      <GrafikOperation periode={periodeDash} />
      <PengingatPlan />
      <KartuStopPenyaluran className="animate-entrance-1" />

      {/* 2. Kalender pekan */}
      <section aria-labelledby="kalender" className="animate-entrance-1 flex flex-col gap-2 rounded-md bg-surface-container-lowest p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 id="kalender" className="text-tag uppercase tracking-wider text-on-surface-variant">
            Status Bongkaran Pekan Ini
          </h2>
          <div className="flex items-center">
            <button type="button" aria-label="Pekan sebelumnya" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} className="touch-44 flex size-7 items-center justify-center rounded-full text-outline active:scale-90">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span className="tabular whitespace-nowrap px-1 text-numeric-sm text-outline">
              W{isoWeek(senin)} - {BULAN_SINGKAT(addDays(senin, 3))}
            </span>
            <button
              type="button"
              aria-label="Pekan berikutnya"
              disabled={thisWeek}
              onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
              className="touch-44 flex size-7 items-center justify-center rounded-full text-outline active:scale-90 disabled:opacity-30"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        <ol className="grid grid-cols-7 gap-1.5">
          {calendarWeek.map((day) => (
            <li key={day.iso}>
              <HariTile day={day} plan={planDates.has(day.iso)} future={day.iso > hariIni} onOpen={() => setHari(day.iso)} />
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-x-space-md gap-y-1 px-1 pt-1">
          <Legend className="bg-amber-500" label="Plan pengiriman" />
          <Legend className="bg-error" label="Anomali susut/Density std. 15 °C" />
        </div>
      </section>

      {/* Laptop (lg): dua kolom berpasangan; HP tetap satu kolom dengan urutan DESIGN.md 9.2. */}
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 lg:items-start">
      {/* 3. Bongkaran */}
      <Kartu
        id="total-bongkaran"
        icon={Truck}
        title={isToday ? 'Bongkaran Hari Ini' : 'Total Bongkaran'}
        className="animate-entrance-2 lg:order-1"
        action={
          <button
            type="button"
            aria-expanded={filter}
            aria-controls="dash-filter"
            onClick={() => setFilter(!filter)}
            className="touch-44 flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-primary active:scale-95"
          >
            {range.preset === 'custom' ? `${formatTanggalIso(range.from)} - ${formatTanggalIso(range.to)}` : presetLabel(range.preset)}
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          </button>
        }
      >
        {filter && (
          <div id="dash-filter">
            <DateFilter id="dash-range" value={range} onChange={setRange} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Diterima" value={formatNumber(total.liter)} unit="L" sub={isToday && losHariIni.length ? `${loSelesaiHariIni} dari ${losHariIni.length} LO` : `${periode.length} MT`} subTone="primary" />
          <Stat label="Transport loss" value={formatSigned(total.transport, 0)} unit="L" sub={total.liter ? formatSigned((total.transport / total.liter) * 100, 2, '%') : '-'} subTone={total.transport < 0 ? 'error' : 'ok'} />
          <Stat label="Discharge loss" value={formatSigned(total.discharge, 0)} unit="L" sub={total.liter ? formatSigned((total.discharge / total.liter) * 100, 2, '%') : '-'} subTone={total.discharge < 0 ? 'error' : 'ok'} />
        </div>

        {/* Per produk, ketuk untuk rincian MT, diterima, transport loss, dan discharge loss. */}
        <div className="flex flex-col rounded-md bg-surface-container-low/70 p-3">
          <div className="flex items-center justify-between pb-1 text-xs font-bold uppercase text-on-surface-variant">
            <span>Produk</span>
            <span>Vol. diterima</span>
          </div>
          {perProduk.length === 0 ? (
            <p className="py-space-sm text-center text-body-sm text-on-surface-variant">Belum ada bongkaran selesai pada rentang ini.</p>
          ) : (
            perProduk.map((x) => {
              const open = buka === x.produk
              const meta = produkMeta(x.produk)
              const panel = `produk-${meta.kode}`
              return (
                <div key={x.produk} className="border-t border-outline-variant/40 first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panel}
                    onClick={() => setBuka(open ? null : x.produk)}
                    className="flex min-h-11 w-full items-center gap-2 text-left"
                  >
                    <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', meta.dot)} />
                    <span className="min-w-0 truncate text-body-md font-bold text-on-surface">{x.produk}</span>
                    <span className="tabular shrink-0 rounded-sm bg-surface-container px-1.5 text-xs text-on-surface-variant">{x.mt} MT</span>
                    <span className="tabular ml-auto whitespace-nowrap text-numeric-md font-bold text-on-surface">{formatNumber(x.liter)} L</span>
                    <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-outline transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && (
                    <div id={panel} className="flex flex-col gap-2 pb-3">
                      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <Mini label="MT" value={`${x.mt}x bongkar`} />
                        <Mini label="Diterima" value={`${formatNumber(x.liter)} L`} />
                        <Mini label="Transport loss" value={`${formatSigned(x.transport, 0)} L`} sub={x.pctT !== null ? formatSigned(x.pctT, 2, '%') : undefined} bad={x.transport < 0} />
                        <Mini label="Discharge loss" value={`${formatSigned(x.discharge, 0)} L`} sub={x.pct !== null ? formatSigned(x.pct, 2, '%') : undefined} bad={x.discharge < 0} />
                      </dl>
                      <ul className="flex flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-lowest/80">
                        {x.rs.map((r) => (
                          <li key={r.id}>
                            <Link to={`/input/${r.id}`} className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-body-sm">
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="tabular truncate font-semibold text-on-surface">
                                  {r.nopol || 'MT'}, LO {r.noLOs.join(', ') || '-'}
                                </span>
                                <span className="tabular text-on-surface-variant">
                                  {formatTanggalIso(r.tanggal)} {r.jam}
                                </span>
                              </span>
                              <span className="tabular flex shrink-0 flex-col items-end">
                                <span className="font-semibold text-on-surface">{r.volumeDO ? `${formatNumber(r.volumeDO)} L` : '-'}</span>
                                <span className="text-on-surface-variant">
                                  T <span className={cn((r.transportLoss ?? 0) < 0 && 'text-error')}>{r.transportLoss != null ? formatSigned(r.transportLoss, 0) : '-'}</span>, D{' '}
                                  <span className={cn((r.gainLoss ?? 0) < 0 && 'text-error')}>{r.gainLoss !== null ? formatSigned(r.gainLoss, 0) : '-'}</span>
                                </span>
                              </span>
                              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-outline" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SlaTile
            icon={Timer}
            label="Rata-rata waktu kirim"
            value={formatDurasi(rataRata(waktuKirim))}
            keterangan={waktuKirim.length ? `Pemesanan (MS2) → selesai bongkar · ${waktuKirim.length} MT` : 'Pemesanan (MS2) → selesai bongkar · belum ada data'}
          />
          <SlaTile
            icon={Gauge}
            label="Rata-rata waktu tempuh"
            value={formatDurasi(rataRata(waktuTempuh))}
            keterangan={waktuTempuh.length ? `Gate out depot → selesai bongkar · ${waktuTempuh.length} MT` : 'Gate out depot → selesai bongkar · belum ada data'}
          />
        </div>
      </Kartu>

      {/* 4. Rencana vs realisasi */}
      <Kartu
        id="plan-hari-ini"
        icon={ClipboardCheck}
        title="Rencana vs Realisasi"
        className="animate-entrance-3 lg:order-2"
        action={targetHariIni > 0 && <span className="tabular whitespace-nowrap text-numeric-sm text-outline">Target {formatNumber(targetHariIni)} L</span>}
      >
        {planHariIni.length === 0 ? (
          <p className="text-center text-body-sm text-on-surface-variant">Tidak ada plan pengiriman untuk hari ini.</p>
        ) : (
          planHariIni.map((x) => {
            const meta = produkMeta(x.produk)
            const pct = Math.round((x.selesai / x.lo) * 100)
            return (
              <div key={x.produk} className="flex flex-col gap-1.5 rounded-md bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn('size-2.5 rounded-full', meta.dot)} />
                    <span className="text-body-md font-bold text-on-surface">{x.produk}</span>
                  </span>
                  <span className={cn('tabular text-xs font-bold', meta.teks)}>
                    {x.selesai} dari {x.lo} LO dibongkar ({pct}%){x.jalan ? `, +${x.jalan} berjalan` : ''}
                  </span>
                </div>
                <div
                  role="meter"
                  aria-label={`${x.produk}: ${x.selesai} dari ${x.lo} LO dibongkar`}
                  aria-valuemin={0}
                  aria-valuemax={x.lo}
                  aria-valuenow={x.selesai}
                  className="flex h-2 overflow-hidden rounded-full bg-surface-container"
                >
                  <div className={cn('h-full transition-[width] duration-500', meta.dot)} style={{ width: `${(x.volSelesai / x.volume) * 100}%` }} />
                  <div className={cn('h-full opacity-40 transition-[width] duration-500', meta.dot)} style={{ width: `${(x.volJalan / x.volume) * 100}%` }} />
                </div>
                <div className="tabular flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                  <span>
                    {formatNumber(x.volSelesai)} L dibongkar{x.volJalan ? ` (${formatNumber(x.volJalan)} L berjalan)` : ''}
                  </span>
                  <span className="whitespace-nowrap">{formatNumber(x.volume)} L target</span>
                </div>
              </div>
            )
          })
        )}
      </Kartu>

      {/* Sertifikat tera metrologi nozzle (maks. 1 tahun) yang lewat atau tinggal ≤ 30 hari. */}
      {teraMasalah.length > 0 && (
        <div role="status" className="animate-entrance-3 flex lg:col-span-2 items-start gap-space-sm rounded-lg border border-amber-300 bg-amber-50 p-space-sm">
          <Gauge aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <span className="min-w-0 flex-1 text-body-sm text-on-surface">
            <b>Tera metrologi:</b> {teraMasalah.map((n) => `${n.nama} ${statusSertifikat(n.teraTanggal, hariIni) === 'lewat' ? 'lewat' : 's/d ' + formatTanggalIso(berlakuSertifikat(n.teraTanggal))}`).join(', ')}
          </span>
          {app.can('/pengaturan/nozzle') && (
            <Link to="/pengaturan/nozzle" className="shrink-0 text-body-sm font-semibold text-primary">
              Atur
            </Link>
          )}
        </div>
      )}

      {/* 5. Kualitas harian */}
      <Kartu
        id="kualitas-harian"
        icon={FlaskConical}
        title="Kualitas Harian (Density std. 15 °C)"
        sub="Uji density terakhir tiap produk, dibanding Density std. 15 °C uji pasca penerimaan terbaru."
        className="animate-entrance-3 lg:order-3"
        action={<span className="tabular whitespace-nowrap rounded-full bg-tertiary-fixed/60 px-2 py-0.5 text-xs font-bold text-tertiary">±{formatDensity(app.rules.densityTolerance)}</span>}
      >
        {belumUji.length > 0 && !lihatBelum && (
          <button
            type="button"
            onClick={() => setLihatBelum(true)}
            className="flex min-h-14 w-full items-center gap-2.5 rounded-md bg-surface-container-low p-3 text-left active:scale-[0.99]"
          >
            <span aria-hidden="true" className="h-8 w-1.5 shrink-0 rounded-full bg-outline-variant" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-md font-bold text-on-surface">
                {belumUji.length === PRODUK_OPTIONS.length ? `${belumUji.length} produk belum diuji` : `${belumUji.length} produk lain belum diuji`}
              </span>
              <span className="truncate text-body-sm text-on-surface-variant">{belumUji.join(', ')}</span>
            </span>
            <Pill>Belum</Pill>
          </button>
        )}
        {PRODUK_OPTIONS.filter((p) => harian.has(p) || lihatBelum).map((p) => {
          const h = harian.get(p)
          const d15 = h ? qqD15(h.k).d15?.value ?? null : null
          const ref = h ? acuanD15(app.reports, p, h.rec.tanggal) : null
          const selisih = d15 !== null && ref ? Math.round((d15 - ref.d15) * 10000) / 10000 : null
          const ok = selisih !== null ? Math.abs(selisih) <= tol : null
          const isi = (
            <>
              <span aria-hidden="true" className={cn('h-8 w-1.5 shrink-0 rounded-full', h ? produkMeta(p).dot : 'bg-outline-variant')} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-bold text-on-surface">{p}</span>
                <span className="tabular truncate text-body-sm text-outline">
                  {h ? (ref ? `Density std. 15 °C acuan ${formatDensity(ref.d15)}` : `${formatTanggalIso(h.rec.tanggal)}, shift ${h.rec.shift}`) : 'Belum diuji'}
                </span>
              </span>
              {h && (
                <span className="tabular flex flex-col items-end">
                  <span className="whitespace-nowrap text-numeric-md font-bold text-on-surface">
                    {formatDensity(d15)} <span className="text-xs font-normal text-on-surface-variant">g/ml</span>
                  </span>
                  <span className={cn('text-xs font-bold', ok === false ? 'text-error' : ok ? 'text-emerald-700' : 'text-on-surface-variant')}>{selisih !== null ? formatDensitySigned(selisih) : 'tanpa acuan'}</span>
                </span>
              )}
              {ok === null ? <Pill>{h ? 'Tanpa acuan' : 'Belum'}</Pill> : ok ? <Pill tone="success">Sesuai</Pill> : <Pill tone="error">Tidak sesuai</Pill>}
            </>
          )
          // Ketuk produk yang sudah diuji: pop up highlight hasil uji terakhir.
          return h ? (
            <button
              key={p}
              type="button"
              aria-label={`Lihat hasil uji ${p}`}
              onClick={() => setUjiKunci(kunciHarian(h.rec.id, h.k.id))}
              className="flex min-h-14 w-full items-center gap-2.5 rounded-md bg-surface-container-low p-3 text-left transition-colors hover:bg-primary-fixed/30 active:scale-[0.99]"
            >
              {isi}
            </button>
          ) : (
            <div key={p} className="flex min-h-14 items-center gap-2.5 rounded-md bg-surface-container-low p-3">
              {isi}
            </div>
          )
        })}
      </Kartu>

      <Sheet open={!!ujiKunci} onOpenChange={(o) => !o && setUjiKunci(null)} title="Hasil uji kualitas harian" description="Highlight data uji terakhir produk ini.">
        {ujiKunci && <KualitasHighlight kunci={ujiKunci} />}
        {ujiKunci && app.can('/laporan/kualitas') && (
          <Link to="/laporan/kualitas" className={buttonVariants({ variant: 'glass' })}>
            Riwayat kualitas harian
          </Link>
        )}
      </Sheet>

      <div className="animate-entrance-4 lg:order-5 lg:col-span-2">
        <KalengSample />
      </div>

      {/* Uji takaran bejana 20 L */}
      <div className="lg:order-6">
        <KartuTakaran hariIni={hariIni} />
      </div>

      {/* 7. Status alur LO */}
      <Kartu
        id="lo-tracking"
        icon={Network}
        title="LO Tracking"
        sub="Status alur Loading Order"
        className="animate-entrance-5 lg:order-4"
        action={
          <Link to="/laporan/lo" className="touch-44 flex items-center gap-0.5 whitespace-nowrap text-xs font-bold text-primary">
            Total {loTotal} LO <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {LO_DASH.map((x) => (
            <Link key={x.key} to="/laporan/lo" className={cn('flex min-w-0 flex-col items-center rounded-md p-2.5 text-center active:scale-[0.98]', x.tile)}>
              <span className={cn('truncate text-xs font-bold uppercase', x.teks)}>{LO_STATUS.find((s) => s.key === x.key)!.label}</span>
              <span className={cn('tabular text-numeric-lg font-bold', x.teks)}>{loCounts.get(x.key) ?? 0}</span>
              <span className={cn('text-xs leading-tight', x.teks)}>{x.sub}</span>
            </Link>
          ))}
        </div>
      </Kartu>


      </div>

      <DetailHari iso={hari} onClose={() => setHari(null)} />
    </div>
  )
}

/** Proteksi kebakaran (APAR & APAB): kondisi dari inspeksi terakhir. Dipakai di Dashboard HSSE & Guard Patrol. */
export function KartuProteksi({ className }: { className?: string }) {
  const app = useApp()
  const hariIni = todayIso()
  const apar = kondisiSemua(app.settings, app.daily.filter((d): d is AparRecord => d.kind === 'apar'), hariIni)
  const aparTemuan = apar.filter((k) => k.status === 'temuan').length
  const aparLewat = apar.filter((k) => k.isiUlang === 'lewat' || k.instansi === 'lewat').length
  if (!apar.length) return null
  return (
      <Kartu
        id="proteksi"
        icon={FireExtinguisher}
        title="Proteksi Kebakaran"
        sub="Kondisi APAR & APAB dari inspeksi terakhir"
        className={className}
        action={
          <Link to="/apar" className="touch-44 flex items-center gap-0.5 whitespace-nowrap text-xs font-bold text-primary">
            {apar.length} unit <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        <div className="mb-2 grid grid-cols-3 divide-x divide-outline-variant/50 rounded-md bg-primary-fixed/50">
          {[
            { label: 'APAR terpasang', value: apar.filter((k) => k.tipe === 'apar' && !k.unit.cadangan).length },
            { label: 'APAR cadangan', value: apar.filter((k) => k.unit.cadangan).length },
            { label: 'APAB', value: apar.filter((k) => k.tipe === 'apab').length },
          ].map((x) => (
            <Link key={x.label} to="/apar" className="flex min-w-0 flex-col items-center px-1 py-2 text-center active:scale-[0.98]">
              <span className="tabular text-numeric-lg font-bold text-on-surface">{x.value}</span>
              <span className="text-xs font-bold uppercase leading-tight text-on-surface-variant">{x.label}</span>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link to="/apar" className="flex flex-col rounded-md bg-emerald-50 p-2.5">
            <span className="text-xs font-bold uppercase text-emerald-700">Baik</span>
            <span className="tabular text-numeric-lg font-bold text-emerald-700">{apar.filter((k) => k.status === 'baik').length}</span>
          </Link>
          <Link to="/apar" className={cn('flex flex-col rounded-md p-2.5', aparTemuan ? 'bg-error-container/60' : 'bg-surface-container-low')}>
            <span className={cn('text-xs font-bold uppercase', aparTemuan ? 'text-error' : 'text-on-surface-variant')}>Ada temuan</span>
            <span className={cn('tabular text-numeric-lg font-bold', aparTemuan ? 'text-error' : 'text-on-surface')}>{aparTemuan}</span>
          </Link>
          <Link to="/apar" className="flex flex-col rounded-md bg-amber-50 p-2.5">
            <span className="text-xs font-bold uppercase text-amber-700">Belum bulan ini</span>
            <span className="tabular text-numeric-lg font-bold text-amber-700">{apar.filter((k) => !k.bulanIni).length}</span>
          </Link>
          <Link to="/apar" className={cn('flex flex-col rounded-md p-2.5', aparLewat ? 'bg-error-container/60' : 'bg-surface-container-low')}>
            <span className={cn('text-xs font-bold uppercase', aparLewat ? 'text-error' : 'text-on-surface-variant')}>Isi ulang / uji instansi lewat</span>
            <span className={cn('tabular text-numeric-lg font-bold', aparLewat ? 'text-error' : 'text-on-surface')}>{aparLewat}</span>
          </Link>
        </div>
      </Kartu>
  )
}

/** Grafik Dashboard Operation: volume diterima per hari/minggu dan komposisi penerimaan per produk. */
function GrafikOperation({ periode }: { periode: PeriodeDashboard }) {
  const app = useApp()
  const dalam = (p: { dari: string; sampai: string }) => app.reports.filter((r) => r.status !== 'draft' && r.tanggal >= p.dari && r.tanggal <= p.sampai)
  const rows = dalam(periode)
  const vol = (r: (typeof rows)[number]) => r.terimaAktual ?? r.volumeDO ?? 0
  const batang = kelompokPeriode(periode, rows.map((r) => ({ tanggal: r.tanggal, value: vol(r) })))
  const perProduk = new Map<string, { v: number; n: number }>()
  for (const r of rows) {
    const x = perProduk.get(r.produk) ?? { v: 0, n: 0 }
    perProduk.set(r.produk, { v: x.v + vol(r), n: x.n + 1 })
  }
  const produk = [...perProduk.entries()].sort((a, b) => b[1].v - a[1].v)
  const total = rows.reduce((a, r) => a + vol(r), 0)
  const lalu = dalam(periodeSebelum(periode)).reduce((a, r) => a + vol(r), 0)
  const delta = lalu > 0 ? ((total - lalu) / lalu) * 100 : null
  const anomali = rows.filter((r) => r.status === 'anomali').length
  return (
    <section aria-labelledby="grafik-penerimaan" className="animate-entrance-2 flex flex-col gap-space-md rounded-md bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="grafik-penerimaan" className="flex items-center gap-2 text-body-md font-semibold text-on-surface-variant">
            <Truck aria-hidden="true" className="size-4 text-primary" />
            Volume diterima
          </h2>
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tabular text-[2rem] font-bold leading-none text-on-surface">{formatNumber(total)}</span>
            <span className="text-body-md font-semibold text-on-surface-variant">liter</span>
            {delta !== null && (
              <span className={cn('tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold', delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                {delta >= 0 ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownLeft aria-hidden="true" className="size-3" />}
                {Math.abs(delta).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%<span className="sr-only"> dibanding periode sebelumnya</span>
              </span>
            )}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {rows.length} bongkaran{anomali ? ` · ${anomali} anomali` : ''}{lalu > 0 ? ` · periode lalu ${formatNumber(lalu)} L` : ''}
          </span>
        </div>
      </div>
      {produk.length > 0 && (
        <ul className="grid grid-cols-2 gap-space-xs sm:grid-cols-3 lg:grid-cols-5" aria-label="Volume diterima per produk">
          {produk.map(([p, x], i) => (
            <li key={p} className="flex flex-col gap-0.5 rounded-md bg-surface-container-low px-space-sm py-space-xs">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: warnaProduk(p, i) }} />
                <span className="truncate">{p}</span>
              </span>
              <span className="tabular text-body-lg font-bold text-on-surface">
                {formatNumber(x.v)} <span className="text-xs font-semibold text-on-surface-variant">L</span>
              </span>
              <span className="text-xs text-on-surface-variant">
                {x.n} bongkaran · {total ? Math.round((x.v / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Volume per {periodeHari(periode) > 31 ? 'pekan' : 'hari'}</span>
        <BarChart data={batang} warna={KATEGORI[0]} satuan=" L" label="Volume diterima" />
      </div>
    </section>
  )
}

const periodeHari = (p: { dari: string; sampai: string }) => Math.round((Date.parse(`${p.sampai}T00:00:00`) - Date.parse(`${p.dari}T00:00:00`)) / 86400_000) + 1

/** Satu hari pada kalender pekan: label, tanggal, titik plan, dan ikon status. */
/** Pengingat plan pengiriman besok: baris amber di alur halaman (tidak menutupi kartu tanggal & shift). */
function PengingatPlan() {
  const app = useApp()
  const besok = app.spbuSiap && app.can('/plan') ? planBesokKurang(app.plans) : null
  if (!besok) return null
  return (
    <Link to="/plan" className="animate-entrance-1 flex min-h-14 items-center gap-space-sm rounded-md border border-amber-300 bg-amber-50 p-space-sm active:scale-[0.99]">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950">
        <CalendarClock className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-md font-bold text-amber-950">Plan pengiriman besok belum dibuat</span>
        <span className="text-body-sm text-amber-900">Kirim {formatTanggalIso(besok)} · buat permintaan MS2 di Plan Pengiriman</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-amber-900" />
    </Link>
  )
}

function HariTile({ day, plan, future, onOpen }: { day: CalendarDay & { iso: string }; plan: boolean; future: boolean; onOpen: () => void }) {
  const anomali = day.status === 'catatan'
  const status = anomali ? 'ada anomali' : day.status === 'sesuai' ? 'bongkaran sesuai' : day.isToday ? 'berjalan' : 'tidak ada data'
  const Icon = anomali ? TriangleAlert : day.status === 'sesuai' ? CircleCheck : day.isToday ? Ellipsis : Minus
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${formatTanggalIso(day.iso)}, ${status}${plan ? ', ada plan pengiriman' : ''}${day.isToday ? ', hari ini' : ''}. Lihat detail`}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-sm py-1.5 transition-transform active:scale-95',
        day.isToday ? 'bg-primary/10 shadow-sm' : anomali ? 'bg-error-container/40' : 'bg-surface-container-low',
        future && !plan && 'opacity-60',
      )}
    >
      <span className={cn('text-xs font-bold uppercase', day.isToday ? 'text-primary' : anomali ? 'text-error' : future ? 'text-on-surface-variant' : 'text-on-surface-variant')}>{day.label}</span>
      <span
        className={cn(
          'tabular relative flex size-8 items-center justify-center rounded-full text-numeric-sm font-semibold',
          day.isToday ? 'bg-primary font-bold text-on-primary shadow-md' : anomali ? 'bg-error-container font-bold text-on-error-container' : future ? 'bg-surface-container-high text-outline' : 'bg-surface-variant text-primary',
        )}
      >
        {String(day.date).padStart(2, '0')}
        {plan && <span aria-hidden="true" className="absolute -bottom-0.5 size-1.5 rounded-full bg-amber-500 shadow-sm" />}
      </span>
      <Icon
        aria-hidden="true"
        strokeWidth={2.5}
        className={cn('size-3.5', anomali ? 'text-error' : day.status === 'sesuai' ? 'text-emerald-600' : day.isToday ? 'text-primary' : 'text-outline')}
      />
    </button>
  )
}

/** Kartu putih bergaya referensi: ikon + judul di dalam kartu. */
function Kartu({ id, icon: Icon, title, sub, action, className, children }: { id: string; icon: typeof Truck; title: string; sub?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="flex min-w-0 flex-col">
            <h2 id={id} className="scroll-mt-24 text-headline-md font-bold text-on-surface">
              {title}
            </h2>
            {sub && <span className="text-xs text-on-surface-variant">{sub}</span>}
          </span>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, unit, sub, subTone }: { label: string; value: string; unit: string; sub: string; subTone: 'primary' | 'ok' | 'error' }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-md bg-surface-container-low p-2.5">
      <span className="text-xs font-bold uppercase leading-tight text-on-surface-variant">{label}</span>
      <span className={cn('tabular mt-1 truncate text-numeric-md font-bold', subTone === 'error' ? 'text-error' : 'text-on-surface')}>
        {value} <span className="text-xs font-normal text-on-surface-variant">{unit}</span>
      </span>
      <span className={cn('tabular mt-0.5 truncate text-xs font-semibold', subTone === 'primary' ? 'text-primary' : subTone === 'error' ? 'text-error' : 'text-emerald-700')}>{sub}</span>
    </div>
  )
}

function Mini({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-sm bg-surface-container-lowest/80 px-2 py-1.5">
      <dt className="text-xs font-bold uppercase text-on-surface-variant">{label}</dt>
      <dd className={cn('tabular text-body-sm font-bold', bad ? 'text-error' : 'text-on-surface')}>
        {value}
        {sub && <span className="ml-1 font-semibold">({sub})</span>}
      </dd>
    </div>
  )
}

function SlaTile({ icon: Icon, label, value, keterangan }: { icon: typeof Timer; label: string; value: string; keterangan: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-md bg-surface-container p-2.5">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold uppercase leading-tight text-on-surface-variant">{label}</span>
        <span className="tabular text-numeric-md font-bold text-on-surface">{value}</span>
        <span className="text-xs leading-tight text-on-surface-variant">{keterangan}</span>
      </span>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-2 rounded-full', className)} />
      <span className="text-xs text-on-surface-variant">{label}</span>
    </span>
  )
}

/** Detail satu tanggal: penerimaan, kualitas, kuantitas, dan stok shift. */
/**
 * Dashboard > Uji Takaran: ringkasan uji bejana 20 L (hari ini, bulan ini) dan hasil terakhir
 * tiap nozzle untuk opsi Preset & Manual. Data dari modul Input > Uji Takaran.
 */
function KartuTakaran({ hariIni }: { hariIni: string }) {
  const app = useApp()
  const semua = app.daily.filter((x): x is TakarRecord => x.kind === 'takar').sort((a, b) => a.createdAt - b.createdAt)
  const bulan = hariIni.slice(0, 7)
  const hari = semua.filter((r) => r.tanggal === hariIni)
  const diBulan = semua.filter((r) => r.tanggal.startsWith(bulan))
  const lewatBulan = diBulan.filter((r) => takarStatus(r.data.hasilMl) === 'lewat').length
  const lewatHari = hari.filter((r) => takarStatus(r.data.hasilMl) === 'lewat').length
  const kunci = (n: string) => n.trim().toUpperCase()
  const nozzleBulan = new Set(diBulan.map((r) => kunci(r.data.nozzle)))
  const totalNozzle = Math.max((app.settings.nozzles ?? []).length, nozzleBulan.size)
  const terakhir = semua[semua.length - 1]
  // Hasil terakhir tiap nozzle per opsi.
  const perNozzle = new Map<string, { nozzle: string; produk: string; P?: TakarRecord; M?: TakarRecord }>()
  for (const r of semua) {
    const k = kunci(r.data.nozzle)
    const cur = perNozzle.get(k) ?? { nozzle: r.data.nozzle, produk: r.data.produk }
    perNozzle.set(k, { ...cur, produk: r.data.produk, [r.data.opsi]: r })
  }
  const nozzles = [...perNozzle.values()].sort((a, b) => a.nozzle.localeCompare(b.nozzle, 'id', { numeric: true }))
  const nilai = (r?: TakarRecord) =>
    r ? <span className={cn('tabular font-bold', takarStatus(r.data.hasilMl) === 'lewat' ? 'text-error' : 'text-on-surface')}>{formatMl(r.data.hasilMl)}</span> : <span className="text-outline">-</span>
  return (
    <Kartu
      id="uji-takaran"
      icon={Beaker}
      title="Uji Takaran"
      sub="Bejana ukur 20 L, batas -60 ml"
      className="animate-entrance-5"
      action={
        <Link to={app.can('/laporan/takaran') ? '/laporan/takaran' : '/takaran'} className="touch-44 flex items-center gap-0.5 whitespace-nowrap text-xs font-bold text-primary">
          Riwayat <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={cn('flex flex-col rounded-md p-2.5', hari.length ? 'bg-emerald-50' : 'bg-amber-50')}>
          <span className={cn('text-xs font-bold uppercase', hari.length ? 'text-emerald-700' : 'text-amber-700')}>Hari ini</span>
          <span className={cn('tabular text-numeric-lg font-bold', hari.length ? 'text-emerald-700' : 'text-amber-700')}>{hari.length}</span>
          <span className={cn('text-xs', lewatHari ? 'font-semibold text-error' : hari.length ? 'text-emerald-700' : 'text-amber-700')}>{lewatHari ? `${lewatHari} lewat toleransi` : hari.length ? 'hasil uji' : 'belum ada uji'}</span>
        </div>
        <div className={cn('flex flex-col rounded-md p-2.5', lewatBulan ? 'bg-error-container/60' : 'bg-surface-container-low')}>
          <span className={cn('text-xs font-bold uppercase', lewatBulan ? 'text-error' : 'text-on-surface-variant')}>Lewat toleransi</span>
          <span className={cn('tabular text-numeric-lg font-bold', lewatBulan ? 'text-error' : 'text-on-surface')}>{lewatBulan}</span>
          <span className="text-xs text-on-surface-variant">bulan ini</span>
        </div>
        <div className="flex flex-col rounded-md bg-surface-container-low p-2.5">
          <span className="text-xs font-bold uppercase text-on-surface-variant">Nozzle diuji</span>
          <span className="tabular text-numeric-lg font-bold text-on-surface">
            {nozzleBulan.size}
            <span className="text-body-sm font-semibold text-outline">/{totalNozzle}</span>
          </span>
          <span className="text-xs text-on-surface-variant">bulan ini</span>
        </div>
        <div className="flex flex-col rounded-md bg-surface-container-low p-2.5">
          <span className="text-xs font-bold uppercase text-on-surface-variant">Uji terakhir</span>
          <span className="tabular truncate text-body-md font-bold text-on-surface">{terakhir ? formatTanggalIso(terakhir.tanggal) : '-'}</span>
          <span className="truncate text-xs text-on-surface-variant">{terakhir ? `${terakhir.data.jam}, Nozzle ${terakhir.data.nozzle}` : 'belum ada'}</span>
        </div>
      </div>
      {nozzles.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Hasil terakhir per nozzle</span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {nozzles.map((n) => {
              const lewat = [n.P, n.M].some((r) => r && takarStatus(r.data.hasilMl) === 'lewat')
              return (
                <div key={n.nozzle} className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm', lewat ? 'bg-error-container/50' : 'bg-surface-container-low')}>
                  <span className="tabular w-16 shrink-0 font-bold text-on-surface">Nozzle {n.nozzle}</span>
                  <span className="min-w-0 flex-1 truncate text-on-surface-variant">{n.produk}</span>
                  <span className="text-xs font-bold text-on-surface-variant">P</span>
                  {nilai(n.P)}
                  <span className="text-xs font-bold text-on-surface-variant">M</span>
                  {nilai(n.M)}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-low p-2.5 text-body-sm text-on-surface-variant">
          Belum ada hasil uji takaran.
          {app.can('/takaran') && (
            <Link to="/takaran" className="font-bold text-primary">
              Mulai uji takaran
            </Link>
          )}
        </div>
      )}
    </Kartu>
  )
}

function DetailHari({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const app = useApp()
  const d = iso ? detailTanggal(iso, app.reports, app.daily) : null
  const plans = iso ? app.plans.filter((p) => p.tanggal === iso) : []
  const diterima = d ? d.bongkaran.filter((r) => r.status !== 'draft').reduce((n, r) => n + (r.volumeDO ?? 0), 0) : 0
  const takarHari = iso ? app.daily.filter((x): x is TakarRecord => x.kind === 'takar' && x.tanggal === iso).sort((a, b) => a.data.jam.localeCompare(b.data.jam)) : []
  return (
    <Sheet open={!!iso} onOpenChange={(o) => !o && onClose()} title={iso ? formatTanggalIso(iso) : ''} description="Plan pengiriman, penerimaan, kualitas, dan kuantitas pada tanggal ini.">
      {d && (
        <>
          <section aria-label="Plan pengiriman" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Plan pengiriman</h3>
            {plans.length === 0 ? (
              <span className="text-body-sm text-on-surface-variant">Tidak ada plan pengiriman.</span>
            ) : (
              plans.flatMap((pl) =>
                pl.los.map((lo) => {
                  const st = loStatusMeta(loStatus(lo, app.usedLoIds))
                  return (
                    <div key={lo.id} className="inset-field flex min-h-12 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body-sm font-semibold text-on-surface">
                          {lo.produk}, <span className="tabular">{formatNumber(lo.volume)} L</span>
                          {lo.shift ? `, shift ${lo.shift}` : ''}
                        </span>
                        <span className="tabular truncate text-body-sm text-on-surface-variant">
                          SO {pl.noSO || '-'}, LO {lo.noLO || 'belum terbit'}, {planSupply(pl, lo) || '-'}
                        </span>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                  )
                }),
              )
            )}
          </section>

          <section aria-label="Penerimaan" className="flex flex-col gap-space-xs">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-body-md font-bold text-on-surface">Penerimaan</h3>
              <span className="tabular text-body-sm text-on-surface-variant">{formatLiter(diterima)} diterima</span>
            </div>
            {d.bongkaran.length === 0 ? (
              <span className="text-body-sm text-on-surface-variant">Tidak ada bongkaran.</span>
            ) : (
              d.bongkaran.map((r) => (
                <Link key={r.id} to={`/input/${r.id}`} onClick={onClose} className="inset-field flex min-h-12 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-sm font-semibold text-on-surface">
                      {r.produk || '-'}, {r.nopol || 'MT'}, {r.jam}
                    </span>
                    <span className="tabular text-body-sm text-on-surface-variant">
                      DO {r.volumeDO ? formatLiter(r.volumeDO) : '-'}, gain/loss {r.gainLoss !== null ? formatSigned(r.gainLoss, 0, ' L') : '-'}
                    </span>
                  </div>
                  <QQPill status={qqOf(r)} label={labelQQ(r, STEPS.length)} />
                </Link>
              ))
            )}
          </section>

          <section aria-label="Kualitas" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Kualitas</h3>
            {d.bongkaran.filter((r) => r.d15 !== null).length === 0 && d.qq.every((q) => !q.data.kualitas.length) && (
              <span className="text-body-sm text-on-surface-variant">Belum ada uji density.</span>
            )}
            {d.bongkaran
              .filter((r) => r.d15 !== null)
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="text-on-surface">
                    Bongkar {r.produk} {r.nopol}
                  </span>
                  <span className={cn('tabular font-semibold', r.densityOk === false ? 'text-error' : 'text-on-surface')}>
                    Density std. 15 °C {formatDensity(r.d15)}
                    {r.d15Depot !== null ? ` (${formatDensitySigned(Math.round((r.d15! - r.d15Depot) * 10000) / 10000)})` : ''}
                  </span>
                </div>
              ))}
            {d.qq.flatMap((q) =>
              q.data.kualitas.map((k) => {
                const v = qqD15(k).d15
                return (
                  <div key={k.id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="text-on-surface">
                      Uji harian shift {q.shift}, {k.produk}
                    </span>
                    <span className="tabular font-semibold text-on-surface">Density std. 15 °C {v ? formatDensity(v.value) : '-'}</span>
                  </div>
                )
              }),
            )}
          </section>

          <section aria-label="Kuantitas" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Kuantitas</h3>
            {takarHari.length === 0 && d.stok.length === 0 && <span className="text-body-sm text-on-surface-variant">Belum ada uji takaran atau stok shift.</span>}
            {takarHari.map((r) => {
              const lewat = takarStatus(r.data.hasilMl) === 'lewat'
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="text-on-surface">
                    Uji takaran {r.data.jam}, Nozzle {r.data.nozzle} ({r.data.produk}) {opsiLabel(r.data.opsi)}
                  </span>
                  <span className={cn('tabular font-semibold', lewat ? 'text-error' : 'text-on-surface')}>{formatMl(r.data.hasilMl)}</span>
                </div>
              )
            })}
            {d.stok.map((s) => (
              <div key={s.id} className="flex flex-col gap-1 text-body-sm">
                <span className="text-on-surface">
                  Stok awal shift {s.shift}, {s.data.petugas || '-'}
                </span>
                <ul className="tabular grid grid-cols-2 gap-x-space-sm text-on-surface-variant">
                  {Object.entries(s.data.items).map(([produk, it]) => (
                    <li key={produk} className="flex justify-between gap-2">
                      <span className="truncate">{produk}</span>
                      <span className="text-on-surface">{formatNumber(parseAngka(it.volume) ?? 0)} L</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </Sheet>
  )
}

