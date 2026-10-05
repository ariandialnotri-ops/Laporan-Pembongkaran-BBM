import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Ellipsis,
  FlaskConical,
  Gauge,
  Minus,
  Network,
  SlidersHorizontal,
  Timer,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import { DateFilter, inRange, presetLabel, useDateRange } from '@/components/bongkaran/date-filter'
import { KalengSample } from '@/components/bongkaran/kaleng-sample'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { bejanaStatus, qqD15, type QqKualitas, type QqRecord } from '@/lib/daily'
import { addDays, formatTanggalIso, formatTanggalPanjang, formatTanggalSingkat, isoWeek, startOfWeek, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { LO_STATUS, loStatus, loStatusMeta, planSupply, type LoDisplayStatus } from '@/lib/plan'
import { produkMeta } from '@/lib/produk'
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
 */
export function Dashboard() {
  const app = useApp()
  const now = new Date()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [hari, setHari] = useState<string | null>(null)
  const [range, setRange] = useDateRange('today')
  const [filter, setFilter] = useState(false)
  const [buka, setBuka] = useState<string | null>(null)

  // Uji kualitas harian terakhir tiap produk.
  const harian = useMemo(() => {
    const m = new Map<string, { k: QqKualitas; rec: QqRecord }>()
    app.daily
      .filter((d): d is QqRecord => d.kind === 'qq')
      .sort((a, b) => (a.tanggal + a.shift + a.data.jam).localeCompare(b.tanggal + b.shift + b.data.jam))
      .forEach((rec) => rec.data.kualitas.forEach((k) => k.produk && qqD15(k).d15 && m.set(k.produk, { k, rec })))
    return m
  }, [app.daily])

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
  const calendarWeek = kalenderMinggu(app.reports, weekAnchor, app.daily, now)
  const planDates = new Set(app.plans.filter((p) => p.los.some((lo) => lo.status !== 'deleted')).map((p) => p.tanggal))
  const senin = startOfWeek(weekAnchor)
  const thisWeek = todayIso(senin) === todayIso(startOfWeek(now))
  const shift = currentShift(now).shift

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
  const slaPermintaan = rataRata(sla.map((x) => x.permintaan))
  const slaPerjalanan = rataRata(sla.map((x) => x.perjalanan))

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
      {/* 1. Operasional & shift */}
      <section aria-label="Operasional SPBU" className="animate-entrance-1 flex items-center justify-between gap-space-sm rounded-md bg-surface-container-lowest/85 p-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <CalendarDays className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">Operasional SPBU</span>
            <span className="truncate text-body-md font-bold text-on-surface" title={formatTanggalPanjang(now)}>
              {formatTanggalPanjang(now).split(', ')[0]}, {formatTanggalSingkat(now)}
            </span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-high/90 px-3 py-1.5 text-primary shadow-sm">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
          <span className="tabular whitespace-nowrap text-[11px] font-bold sm:text-tag">{shiftLabel(shift)}</span>
        </span>
      </section>

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
          <Legend className="bg-error" label="Anomali susut/D15" />
        </div>
      </section>

      {/* 3. Bongkaran */}
      <Kartu
        id="total-bongkaran"
        icon={Truck}
        title={isToday ? 'Bongkaran Hari Ini' : 'Total Bongkaran'}
        className="animate-entrance-2"
        action={
          <button
            type="button"
            aria-expanded={filter}
            aria-controls="dash-filter"
            onClick={() => setFilter(!filter)}
            className="touch-44 flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-bold text-primary active:scale-95"
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
          <div className="flex items-center justify-between pb-1 text-[11px] font-bold uppercase text-outline">
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
                    <span className="tabular shrink-0 rounded-sm bg-surface-container px-1.5 text-[10px] text-on-surface-variant">{x.mt} MT</span>
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

        <div className="grid grid-cols-2 gap-2">
          <SlaTile icon={Timer} label="Req MS2 → selesai" value={formatDurasi(slaPermintaan)} title="Rata-rata request MS2 sampai selesai bongkar" />
          <SlaTile icon={Gauge} label="Gate out → selesai" value={formatDurasi(slaPerjalanan)} title="Rata-rata gate out depot sampai selesai bongkar" />
        </div>
      </Kartu>

      {/* 4. Rencana vs realisasi */}
      <Kartu
        id="plan-hari-ini"
        icon={ClipboardCheck}
        title="Rencana vs Realisasi"
        className="animate-entrance-3"
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
                  <span className={cn('tabular text-[11px] font-bold', meta.teks)}>
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
                <div className="tabular flex items-center justify-between gap-2 text-[11px] text-outline">
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

      {/* 5. Kualitas harian */}
      <Kartu
        id="kualitas-harian"
        icon={FlaskConical}
        title="Kualitas Harian (D15)"
        sub="Uji density terakhir tiap produk, dibanding D15 bongkaran terakhir."
        className="animate-entrance-3"
        action={<span className="tabular whitespace-nowrap rounded-full bg-tertiary-fixed/60 px-2 py-0.5 text-[11px] font-bold text-tertiary">±{formatDensity(app.rules.densityTolerance)}</span>}
      >
        {PRODUK_OPTIONS.map((p) => {
          const h = harian.get(p)
          const d15 = h ? qqD15(h.k).d15?.value ?? null : null
          const ref = h ? acuanD15(app.reports, p, h.rec.tanggal) : null
          const selisih = d15 !== null && ref ? Math.round((d15 - ref.d15) * 10000) / 10000 : null
          const ok = selisih !== null ? Math.abs(selisih) <= tol : null
          return (
            <div key={p} className="flex min-h-14 items-center gap-2.5 rounded-md bg-surface-container-low p-3">
              <span aria-hidden="true" className={cn('h-8 w-1.5 shrink-0 rounded-full', h ? produkMeta(p).dot : 'bg-outline-variant')} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-bold text-on-surface">{p}</span>
                <span className="tabular truncate text-body-sm text-outline">
                  {h ? (ref ? `D15 acuan ${formatDensity(ref.d15)}` : `${formatTanggalIso(h.rec.tanggal)}, shift ${h.rec.shift}`) : 'Belum diuji'}
                </span>
              </span>
              {h && (
                <span className="tabular flex flex-col items-end">
                  <span className="whitespace-nowrap text-numeric-md font-bold text-on-surface">
                    {formatDensity(d15)} <span className="text-[10px] font-normal text-outline">g/ml</span>
                  </span>
                  <span className={cn('text-[11px] font-bold', ok === false ? 'text-error' : ok ? 'text-emerald-700' : 'text-outline')}>{selisih !== null ? formatDensitySigned(selisih) : 'tanpa acuan'}</span>
                </span>
              )}
              {ok === null ? <Pill>{h ? 'Tanpa acuan' : 'Belum'}</Pill> : ok ? <Pill tone="success">Sesuai</Pill> : <Pill tone="error">Tidak sesuai</Pill>}
            </div>
          )
        })}
      </Kartu>

      <div className="animate-entrance-4">
        <KalengSample />
      </div>

      {/* 7. Status alur LO */}
      <Kartu
        id="lo-tracking"
        icon={Network}
        title="LO Tracking"
        sub="Status alur Loading Order"
        className="animate-entrance-5"
        action={
          <Link to="/laporan/lo" className="touch-44 flex items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-primary">
            Total {loTotal} LO <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {LO_DASH.map((x) => (
            <Link key={x.key} to="/laporan/lo" className={cn('flex min-w-0 flex-col items-center rounded-md p-2.5 text-center active:scale-[0.98]', x.tile)}>
              <span className={cn('truncate text-[10px] font-bold uppercase', x.teks)}>{LO_STATUS.find((s) => s.key === x.key)!.label}</span>
              <span className={cn('tabular text-numeric-lg font-bold', x.teks)}>{loCounts.get(x.key) ?? 0}</span>
              <span className={cn('text-[10px] leading-tight', x.teks)}>{x.sub}</span>
            </Link>
          ))}
        </div>
      </Kartu>

      <DetailHari iso={hari} onClose={() => setHari(null)} />
    </div>
  )
}

/** Satu hari pada kalender pekan: label, tanggal, titik plan, dan ikon status. */
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
      <span className={cn('text-[10px] font-bold uppercase', day.isToday ? 'text-primary' : anomali ? 'text-error' : future ? 'text-outline' : 'text-on-surface-variant')}>{day.label}</span>
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
            {sub && <span className="text-[11px] text-outline">{sub}</span>}
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
      <span className="text-[10px] font-bold uppercase leading-tight text-on-surface-variant">{label}</span>
      <span className={cn('tabular mt-1 truncate text-numeric-md font-bold', subTone === 'error' ? 'text-error' : 'text-on-surface')}>
        {value} <span className="text-[10px] font-normal text-outline">{unit}</span>
      </span>
      <span className={cn('tabular mt-0.5 truncate text-[10px] font-semibold', subTone === 'primary' ? 'text-primary' : subTone === 'error' ? 'text-error' : 'text-emerald-700')}>{sub}</span>
    </div>
  )
}

function Mini({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-sm bg-surface-container-lowest/80 px-2 py-1.5">
      <dt className="text-[10px] font-bold uppercase text-outline">{label}</dt>
      <dd className={cn('tabular text-body-sm font-bold', bad ? 'text-error' : 'text-on-surface')}>
        {value}
        {sub && <span className="ml-1 font-semibold">({sub})</span>}
      </dd>
    </div>
  )
}

function SlaTile({ icon: Icon, label, value, title }: { icon: typeof Timer; label: string; value: string; title: string }) {
  return (
    <div title={title} className="flex min-w-0 items-center gap-2.5 rounded-md bg-surface-container p-2.5">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[10px] font-semibold uppercase leading-tight text-outline">{label}</span>
        <span className="tabular text-numeric-md font-bold text-on-surface">{value}</span>
      </span>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-2 rounded-full', className)} />
      <span className="text-[11px] text-outline">{label}</span>
    </span>
  )
}

/** Detail satu tanggal: penerimaan, kualitas, kuantitas, dan stok shift. */
function DetailHari({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const app = useApp()
  const d = iso ? detailTanggal(iso, app.reports, app.daily) : null
  const plans = iso ? app.plans.filter((p) => p.tanggal === iso) : []
  const diterima = d ? d.bongkaran.filter((r) => r.status !== 'draft').reduce((n, r) => n + (r.volumeDO ?? 0), 0) : 0
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
                    D15 {formatDensity(r.d15)}
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
                    <span className="tabular font-semibold text-on-surface">D15 {v ? formatDensity(v.value) : '-'}</span>
                  </div>
                )
              }),
            )}
          </section>

          <section aria-label="Kuantitas" className="flex flex-col gap-space-xs">
            <h3 className="text-body-md font-bold text-on-surface">Kuantitas</h3>
            {d.qq.every((q) => !q.data.kuantitas.length) && d.stok.length === 0 && <span className="text-body-sm text-on-surface-variant">Belum ada uji bejana atau stok shift.</span>}
            {d.qq.flatMap((q) =>
              q.data.kuantitas.map((n) => {
                const lewat = bejanaStatus(n.selisihMl) === 'lewat'
                return (
                  <div key={n.id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="text-on-surface">
                      Shift {q.shift}, {n.nozzle} ({n.produk})
                    </span>
                    <span className={cn('tabular font-semibold', lewat ? 'text-error' : 'text-on-surface')}>{n.selisihMl || '-'} ml</span>
                  </div>
                )
              }),
            )}
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

