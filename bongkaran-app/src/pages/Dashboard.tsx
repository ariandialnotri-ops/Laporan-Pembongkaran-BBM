import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FlaskConical, Scale, Truck } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { KalengSample } from '@/components/bongkaran/kaleng-sample'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { bejanaStatus, qqD15, type QqKualitas, type QqRecord } from '@/lib/daily'
import { addDays, formatTanggalIso, startOfWeek, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { LO_STATUS, loStatus, type LoDisplayStatus } from '@/lib/plan'
import { acuanD15, detailTanggal, kalenderMinggu, labelQQ, qqOf, type CalendarDay } from '@/lib/ringkasan'
import { PRODUK_OPTIONS, STEPS } from '@/lib/sop'
import { cn } from '@/lib/utils'

const DAY_CLASS: Record<CalendarDay['status'], string> = {
  sesuai: 'bg-primary-fixed text-on-primary-fixed',
  catatan: 'bg-error-container text-on-error-container',
  belum: 'inset-field text-on-surface-variant',
}

const DAY_LABEL: Record<CalendarDay['status'], string> = {
  sesuai: 'sesuai',
  catatan: 'ada anomali',
  belum: 'belum ada data',
}

/** Status LO yang diringkas di kartu LO Tracking; Alih Supply & Deleted ada di riwayat. */
const LO_DASH: LoDisplayStatus[] = ['proses', 'os', 'planned', 'delivery', 'delivered', 'closed']

/**
 * Dashboard hanya menampilkan data: kalender progress, total bongkaran,
 * hasil kualitas harian, kaleng sample 3 bongkaran terakhir, dan LO tracking.
 * Semua pengisian ada di menu Input, semua riwayat di menu Laporan.
 */
export function Dashboard() {
  const app = useApp()
  const now = new Date()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [hari, setHari] = useState<string | null>(null)
  const [range, setRange] = useDateRange('today')

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

  if (!app.loaded) return <Loading />

  const calendarWeek = kalenderMinggu(app.reports, weekAnchor, app.daily, now)
  const thisWeek = todayIso(startOfWeek(weekAnchor)) === todayIso(startOfWeek(now))

  const periode = app.reports.filter((r) => r.status !== 'draft' && inRange(r.tanggal, range))
  const totalLiter = periode.reduce((n, r) => n + (r.volumeDO ?? 0), 0)
  const gainLoss = periode.reduce((n, r) => n + (r.gainLoss ?? 0), 0)
  const perProduk = PRODUK_OPTIONS.map((p) => {
    const rs = periode.filter((r) => r.produk === p)
    return { produk: p, mt: rs.length, liter: rs.reduce((n, r) => n + (r.volumeDO ?? 0), 0) }
  }).filter((x) => x.mt > 0)
  const tol = app.rules.densityTolerance + 1e-9

  return (
    <div className="flex flex-col gap-space-lg">
      <section aria-labelledby="kalender" className="animate-entrance-1 flex flex-col gap-space-xs">
        <SectionHeader
          id="kalender"
          title="Kalender Progress"
          action={
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Minggu sebelumnya" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} className="flex size-11 items-center justify-center rounded-full text-on-surface-variant active:scale-95">
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
              <span className="whitespace-nowrap text-body-sm text-on-surface-variant">{weekAnchor.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</span>
              <button
                type="button"
                aria-label="Minggu berikutnya"
                disabled={thisWeek}
                onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
                className="flex size-11 items-center justify-center rounded-full text-on-surface-variant active:scale-95 disabled:opacity-30"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </div>
          }
        />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <ol className="grid grid-cols-7 gap-1">
            {calendarWeek.map((day) => (
              <li key={day.iso} className="flex flex-col items-center gap-1.5">
                <span className={cn('text-tag uppercase text-on-surface-variant', day.isToday && 'text-primary')}>{day.label}</span>
                <button
                  type="button"
                  onClick={() => setHari(day.iso)}
                  aria-label={`${formatTanggalIso(day.iso)}, ${DAY_LABEL[day.status]}${day.isToday ? ', hari ini' : ''}. Lihat detail`}
                  className={cn(
                    'tabular touch-44 flex size-10 items-center justify-center rounded-full text-numeric-sm font-bold transition-transform active:scale-90',
                    day.isToday ? 'bg-primary text-on-primary shadow-[0_6px_16px_rgba(0,102,255,0.3)]' : DAY_CLASS[day.status],
                  )}
                >
                  {day.date}
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-x-space-md gap-y-1 border-t border-outline-variant/40 pt-space-sm">
            <Legend className="bg-primary-fixed" label="Sesuai" />
            <Legend className="bg-error-container ring-1 ring-error/30" label="Ada anomali" />
            <Legend className="inset-field ring-1 ring-outline-variant" label="Belum ada" />
            <span className="text-body-sm text-on-surface-variant">Ketuk tanggal untuk detail.</span>
          </div>
        </GlassCard>
      </section>

      <section aria-labelledby="total-bongkaran" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="total-bongkaran" title="Total Bongkaran" />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <DateFilter id="dash-range" value={range} onChange={setRange} />
          <div className="flex flex-col">
            <span className="text-tag uppercase text-on-surface-variant">{range.preset === 'today' ? 'Diterima hari ini' : 'Diterima pada periode ini'}</span>
            <span className="tabular text-numeric-lg font-bold text-on-surface sm:text-headline-xl">{formatLiter(totalLiter)}</span>
          </div>
          <div className="grid grid-cols-2 gap-space-xs">
            <StatTile label="Mobil tangki" value={periode.length} hint="Bongkaran selesai" icon={Truck} />
            <StatTile label="Gain / loss" value={formatSigned(gainLoss, 0, ' L')} hint="Total periode" icon={Scale} tone={gainLoss < 0 ? 'error' : 'primary'} />
          </div>
          {perProduk.length > 0 && (
            <ul className="flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
              {perProduk.map((x) => (
                <li key={x.produk} className="flex items-center justify-between gap-2 py-space-xs">
                  <span className="text-body-md text-on-surface">{x.produk}</span>
                  <span className="tabular text-body-sm text-on-surface-variant">
                    {x.mt} MT, <span className="font-semibold text-on-surface">{formatNumber(x.liter)} L</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </section>

      <section aria-labelledby="kualitas-harian" className="animate-entrance-3 flex flex-col gap-space-xs">
        <SectionHeader id="kualitas-harian" title="Kualitas Harian" action={<FlaskConical aria-hidden="true" className="size-5 text-on-surface-variant" />} />
        <p className="px-space-xs text-body-sm text-on-surface-variant">Uji density terakhir tiap produk, dibanding D15 bongkaran terakhir.</p>
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 px-space-sm">
          {PRODUK_OPTIONS.map((p) => {
            const h = harian.get(p)
            const d15 = h ? qqD15(h.k).d15?.value ?? null : null
            const ref = h ? acuanD15(app.reports, p, h.rec.tanggal) : null
            const selisih = d15 !== null && ref ? Math.round((d15 - ref.d15) * 10000) / 10000 : null
            const ok = selisih !== null ? Math.abs(selisih) <= tol : null
            return (
              <div key={p} className="flex min-h-14 items-center gap-space-sm py-space-xs">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md font-semibold text-on-surface">{p}</span>
                  <span className="tabular truncate text-body-sm text-on-surface-variant">
                    {h ? `${formatTanggalIso(h.rec.tanggal)}, shift ${h.rec.shift}` : 'Belum diuji'}
                  </span>
                </span>
                {h && (
                  <span className="tabular flex flex-col items-end">
                    <span className="text-numeric-sm font-bold text-on-surface">{formatDensity(d15)}</span>
                    <span className={cn('text-body-sm', ok === false ? 'font-semibold text-error' : 'text-on-surface-variant')}>{selisih !== null ? formatDensitySigned(selisih) : 'tanpa acuan'}</span>
                  </span>
                )}
                {ok === null ? <Pill>{h ? 'Tanpa acuan' : 'Belum'}</Pill> : ok ? <Pill tone="success">Sesuai</Pill> : <Pill tone="error">Tidak sesuai</Pill>}
              </div>
            )
          })}
        </GlassCard>
      </section>

      <div className="animate-entrance-4">
        <KalengSample />
      </div>

      <Link to="/laporan/lo" className="animate-entrance-5 glass-2 rim-light flex flex-col gap-space-sm rounded-lg p-space-md active:scale-[0.99]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-headline-md font-bold text-on-surface">LO Tracking</h2>
          <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />
        </div>
        <div className="grid grid-cols-3 gap-space-xs">
          {LO_DASH.map((k) => (
            <div key={k} className="flex min-w-0 flex-col rounded-md bg-surface-container-low/80 p-space-xs">
              <span className="truncate text-tag uppercase text-on-surface-variant">{LO_STATUS.find((s) => s.key === k)!.label}</span>
              <span className="tabular text-numeric-md font-bold text-on-surface">{loCounts.get(k) ?? 0}</span>
            </div>
          ))}
        </div>
      </Link>

      <DetailHari iso={hari} onClose={() => setHari(null)} />
    </div>
  )
}

/** Detail satu tanggal: penerimaan, kualitas, kuantitas, dan stok shift. */
function DetailHari({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const app = useApp()
  const d = iso ? detailTanggal(iso, app.reports, app.daily) : null
  const diterima = d ? d.bongkaran.filter((r) => r.status !== 'draft').reduce((n, r) => n + (r.volumeDO ?? 0), 0) : 0
  return (
    <Sheet open={!!iso} onOpenChange={(o) => !o && onClose()} title={iso ? formatTanggalIso(iso) : ''} description="Penerimaan, kualitas, dan kuantitas pada tanggal ini.">
      {d && (
        <>
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

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn('size-2.5 rounded-full', className)} />
      <span className="text-body-sm text-on-surface-variant">{label}</span>
    </span>
  )
}
