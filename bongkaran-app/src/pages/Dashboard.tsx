import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Beaker,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  FileText,
  FlaskConical,
  Fuel,
  Ruler,
  Scale,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { QQPill } from '@/components/bongkaran/qq-pill'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { StokGate } from '@/components/bongkaran/stok-gate'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Sheet } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/lib/app-state'
import { BEJANA_LIMIT_ML, bejanaStatus, qqD15 } from '@/lib/daily'
import { addDays, formatBulanTahun, formatTanggalIso, formatTanggalPanjang, greeting, startOfWeek, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { LO_STATUS, loStatus, type LoDisplayStatus } from '@/lib/plan'
import { detailTanggal, kalenderMinggu, kualitasProduk, kuantitasNozzle, labelQQ, qqOf, ringkasHariIni, type CalendarDay } from '@/lib/ringkasan'
import { STEPS } from '@/lib/sop'
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

/** Status LO yang ditampilkan ringkas di HOME; Alih Supply & Deleted ada di Plan Kirim. */
const LO_HOME: LoDisplayStatus[] = ['proses', 'os', 'planned', 'delivery', 'delivered', 'closed']

export function Dashboard() {
  const app = useApp()
  const now = new Date()
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [hari, setHari] = useState<string | null>(null)

  const loCounts = useMemo(() => {
    const c = new Map<LoDisplayStatus, number>()
    app.plans.forEach((p) => p.los.forEach((lo) => c.set(loStatus(lo, app.usedLoIds), (c.get(loStatus(lo, app.usedLoIds)) ?? 0) + 1)))
    return c
  }, [app.plans, app.usedLoIds])
  const kualitas = useMemo(() => kualitasProduk(app.reports), [app.reports])
  const kuantitas = useMemo(() => kuantitasNozzle(app.daily, app.settings.nozzles), [app.daily, app.settings.nozzles])

  if (!app.loaded) return <Loading />

  const today = ringkasHariIni(app.reports, now)
  const calendarWeek = kalenderMinggu(app.reports, weekAnchor, app.daily, now)
  const thisWeek = todayIso(startOfWeek(weekAnchor)) === todayIso(startOfWeek(now))
  const terbaru = app.reports.slice(0, 5)
  const nama = app.session.user ? app.displayName.split(/[\s@]/)[0] : app.settings.namaPetugasDefault.split(' ')[0]

  return (
    <div className="flex flex-col gap-space-md">
      <StokGate className="animate-entrance-1" />

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">
          {greeting(now)}
          {nama ? `, ${nama}` : ''}
        </span>
        <div className="flex min-w-0 items-center gap-space-sm">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Truck className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-on-surface-variant">Total bongkaran hari ini</span>
            <span className="tabular text-numeric-lg font-bold text-on-surface sm:text-headline-xl">{formatLiter(today.totalLiter)}</span>
          </div>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          {formatTanggalPanjang(now)}
          {app.backend.mode === 'local' ? '. Mode lokal: data hanya di perangkat ini.' : ''}
        </span>
        <Link to="/input" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
          Input bongkaran baru
          <ArrowRight aria-hidden="true" />
        </Link>
      </GlassCard>

      <section aria-labelledby="angka-hari-ini" className="animate-entrance-2">
        <h2 id="angka-hari-ini" className="sr-only">
          Angka hari ini
        </h2>
        <div className="grid grid-cols-2 gap-space-xs lg:grid-cols-4">
          <StatTile label="Mobil tangki" value={today.mobilTangki} hint="Datang hari ini" icon={Truck} />
          <StatTile label="Gain / loss" value={formatSigned(today.gainLoss, 0, ' L')} hint="Bongkaran selesai" icon={Scale} tone={today.gainLoss < 0 ? 'error' : 'primary'} />
          <StatTile label="Q&Q sesuai" value={`${today.qqSesuai}/${today.qqTotal}`} hint="Selesai hari ini" icon={FlaskConical} tone="primary" />
          <StatTile
            label="Perlu cek"
            value={today.perluCek.length}
            hint={today.perluCek.length > 0 ? today.perluCek.map((r) => r.nopol).join(', ') : 'Semua aman'}
            icon={Beaker}
            tone={today.perluCek.length > 0 ? 'error' : 'primary'}
          />
        </div>
      </section>

      <nav aria-label="Aksi cepat" className="animate-entrance-3 grid grid-cols-3 gap-space-xs">
        <QuickAction to="/input" icon={ClipboardPlus} label="Input Bongkaran" />
        <QuickAction to="/qq" icon={Beaker} label="Q&Q Harian" />
        <QuickAction to="/stok" icon={Fuel} label="Stok Shift" />
        <QuickAction to="/plan" icon={ClipboardList} label="Plan Kirim" />
        <QuickAction to="/kalkulator" icon={Calculator} label="Kalkulator" />
        <QuickAction to="/laporan" icon={FileText} label="Laporan" />
      </nav>

      {/* Ringkas SO & LO: detail lengkap per status di Plan Kirim. */}
      <Link to="/plan" className="animate-entrance-3 glass-2 rim-light flex flex-col gap-space-sm rounded-lg p-space-md active:scale-[0.99]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-headline-md font-bold text-on-surface">SO & LO</h2>
          <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />
        </div>
        <div className="grid grid-cols-3 gap-space-xs">
          {LO_HOME.map((k) => (
            <div key={k} className="flex flex-col rounded-md bg-surface-container-low/80 p-space-xs">
              <span className="truncate text-tag uppercase text-on-surface-variant">{LO_STATUS.find((s) => s.key === k)!.label}</span>
              <span className="tabular text-numeric-md font-bold text-on-surface">{loCounts.get(k) ?? 0}</span>
            </div>
          ))}
        </div>
      </Link>

      <div className="grid gap-space-md lg:grid-cols-2">
        <section aria-labelledby="kalender-progress" className="animate-entrance-4 flex flex-col gap-space-sm">
          <SectionHeader
            id="kalender-progress"
            title="Kalender"
            action={
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Minggu sebelumnya" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} className="flex size-11 items-center justify-center rounded-full text-on-surface-variant active:scale-95">
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </button>
                <span className="whitespace-nowrap text-body-sm text-on-surface-variant">{formatBulanTahun(weekAnchor)}</span>
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

        {/* Dashboard kualitas & kuantitas dipisah. */}
        <section aria-label="Kualitas dan kuantitas" className="animate-entrance-4 flex flex-col gap-space-sm">
          <Tabs defaultValue="kualitas">
            <QQTabs />
            <TabsContent value="kualitas" className="mt-space-sm">
              <GlassCard level={2} className="flex flex-col gap-space-xs p-space-sm">
                <span className="px-space-xs text-body-sm text-on-surface-variant">Density 15°C dari 3 bongkaran terakhir tiap produk, dibanding D15 dokumen depot.</span>
                {kualitas.map((k) => (
                  <div key={k.produk} className="flex flex-col gap-space-xs rounded-md bg-surface-container-lowest/50 p-space-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body-md font-semibold text-on-surface">{k.produk}</span>
                      <QQPill status={k.status} label={k.status === 'sesuai' ? 'Sesuai ketentuan' : k.status === 'perhatian' ? 'Ada anomali' : 'Belum ada sampel'} />
                    </div>
                    {k.samples.length > 0 && (
                      <ol className="grid grid-cols-3 gap-space-xs">
                        {k.samples.map((s) => (
                          <li key={s.id} className={cn('flex flex-col rounded-md px-space-xs py-1', s.ok === false ? 'bg-error-container/70' : 'bg-surface-container-low/80')}>
                            <span className="tabular text-numeric-sm font-bold text-on-surface">{formatDensity(s.d15)}</span>
                            <span className={cn('tabular text-body-sm', s.ok === false ? 'font-semibold text-error' : 'text-on-surface-variant')}>
                              {s.selisih !== null ? formatDensitySigned(s.selisih) : '-'}
                            </span>
                            <span className="truncate text-body-sm text-on-surface-variant">{formatTanggalIso(s.tanggal)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </GlassCard>
            </TabsContent>
            <TabsContent value="kuantitas" className="mt-space-sm">
              <GlassCard level={2} className="flex flex-col gap-space-xs p-space-sm">
                <span className="px-space-xs text-body-sm text-on-surface-variant">
                  Hasil tera bejana 20 L terakhir tiap nozzle. Di bawah {formatNumber(BEJANA_LIMIT_ML)} ml ditandai merah.
                </span>
                {kuantitas.length === 0 && (
                  <Link to="/pengaturan#nozzle" className="px-space-xs text-body-sm font-semibold text-primary underline">
                    Atur daftar nozzle di Pengaturan
                  </Link>
                )}
                {kuantitas.map((g) => (
                  <div key={g.produk} className="flex flex-col gap-space-xs rounded-md bg-surface-container-lowest/50 p-space-sm">
                    <span className="text-body-md font-semibold text-on-surface">{g.produk}</span>
                    <ul className="grid grid-cols-2 gap-space-xs">
                      {g.nozzles.map((n) => (
                        <li key={n.key} className={cn('flex flex-col rounded-md px-space-xs py-1', n.lewat ? 'bg-error-container/70' : 'bg-surface-container-low/80')}>
                          <span className="text-body-sm font-semibold text-on-surface">{n.nozzle}</span>
                          <span className={cn('tabular text-numeric-sm font-bold', n.lewat ? 'text-error' : 'text-on-surface')}>
                            {n.selisihMl === null ? 'Belum diuji' : `${formatSigned(n.selisihMl, 0)} ml`}
                          </span>
                          {n.tanggal && <span className="tabular text-tag normal-case tracking-normal text-on-surface-variant">{formatTanggalIso(n.tanggal)}, shift {n.shift}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </GlassCard>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <section aria-labelledby="riwayat-bongkaran" className="animate-entrance-5 flex flex-col gap-space-sm">
        <SectionHeader
          id="riwayat-bongkaran"
          title="Riwayat Bongkaran"
          action={
            <Link to="/laporan" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Semua
              <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        {terbaru.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada bongkaran tercatat.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-space-xs">
            {terbaru.map((r) => (
              <BongkarRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      <DetailHari iso={hari} onClose={() => setHari(null)} />
    </div>
  )
}

function QQTabs() {
  // TabsList butuh indeks aktif untuk indikator geser; Radix menyimpan state di Root.
  const [i, setI] = useState(0)
  return (
    <TabsList count={2} index={i} aria-label="Dashboard">
      <TabsTrigger value="kualitas" onClick={() => setI(0)} onFocus={() => setI(0)}>
        <FlaskConical aria-hidden="true" />
        Kualitas
      </TabsTrigger>
      <TabsTrigger value="kuantitas" onClick={() => setI(1)} onFocus={() => setI(1)}>
        <Ruler aria-hidden="true" />
        Kuantitas
      </TabsTrigger>
    </TabsList>
  )
}

function BongkarRow({ r }: { r: ReturnType<typeof useApp>['reports'][number] }) {
  const qq = qqOf(r)
  return (
    <Link to={`/input/${r.id}`}>
      <GlassCard level={1} className="transition-shadow duration-200 hover:shadow-md">
        <div className="flex items-center gap-space-sm p-space-sm">
          <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', qq === 'perhatian' ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary')}>
            <Truck className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-body-md font-semibold text-on-surface">{r.produk || 'Produk belum dipilih'}</span>
              <QQPill status={qq} label={labelQQ(r, STEPS.length)} />
            </div>
            <span className="truncate text-body-sm text-on-surface-variant">
              <span className="tabular">{r.nopol || 'MT baru'}</span>, {formatTanggalIso(r.tanggal)} {r.jam}
              {r.shift ? `, shift ${r.shift}` : ''}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="tabular text-numeric-md font-bold text-on-surface">{r.volumeDO ? formatLiter(r.volumeDO) : '-'}</span>
            {r.gainLoss !== null && <span className={cn('tabular text-numeric-sm', r.gainLoss < 0 ? 'text-error' : 'text-on-surface-variant')}>{formatSigned(r.gainLoss, 0, ' L')}</span>}
          </div>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
        </div>
      </GlassCard>
    </Link>
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

const QUICK_ACTION_CLASS =
  'glass-1 rim-light flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg p-space-xs text-center transition-transform duration-200 active:scale-95'

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className={QUICK_ACTION_CLASS}>
      <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="text-body-sm font-semibold leading-tight text-on-surface">{label}</span>
    </Link>
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
