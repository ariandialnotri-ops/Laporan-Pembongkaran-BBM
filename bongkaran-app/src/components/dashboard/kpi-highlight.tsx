import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Target } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { InfoPop } from '@/components/ui/info-pop'
import { Sheet } from '@/components/ui/sheet'
import { kondisiSemua } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import type { ClosingData } from '@/lib/closing'
import type { AparRecord, InsidenRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { JUMLAH_SLOT, slotKini, statusSlot, type GtsRecord } from '@/lib/gts'
import { hentiDari } from '@/lib/insiden'
import { kpiFinance, kpiHsse, kpiOperation, type Kpi, type StatusKpi } from '@/lib/kpi'
import { formKategori } from '@/lib/ops'
import type { PettyRecord } from '@/lib/petty'
import { TANKS } from '@/lib/tank'
import type { TotalizerData } from '@/lib/totalizer'
import { useAir } from '@/lib/use-air'
import { useCatatan } from '@/lib/use-catatan'
import { useOps } from '@/lib/use-ops'
import { cn } from '@/lib/utils'

const NADA: Record<StatusKpi, { garis: string; teks: string; label: string }> = {
  ok: { garis: 'bg-emerald-500', teks: 'text-emerald-800', label: 'Capai target' },
  pengingat: { garis: 'bg-amber-400', teks: 'text-amber-800', label: 'Mendekati target' },
  anomali: { garis: 'bg-error', teks: 'text-error', label: 'Di bawah target' },
  kosong: { garis: 'bg-outline-variant', teks: 'text-on-surface-variant', label: 'Belum ada data' },
}

/** Deret kartu KPI (highlight) di atas dashboard; ketuk kartu untuk definisi, rumus, dan target. */
export function KpiStrip({ judul, kpi, className }: { judul: string; kpi: Kpi[] | null; className?: string }) {
  const [buka, setBuka] = useState<Kpi | null>(null)
  const capai = kpi?.filter((k) => k.status === 'ok').length ?? 0
  const dinilai = kpi?.filter((k) => k.status !== 'kosong').length ?? 0
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', className)}>
      <div className="flex items-center gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
          <Target className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">{judul}</span>
          <span className="text-body-sm text-on-surface-variant">{kpi === null ? 'Menghitung…' : `${capai} dari ${dinilai} KPI capai target · bulan berjalan`}</span>
        </div>
        <InfoPop judul="Model KPI">
          <p>Setiap KPI dihitung otomatis dari data aplikasi bulan berjalan dan dibandingkan dengan targetnya.</p>
          <p>Hijau = capai target, amber = mendekati target, merah = di bawah target, abu-abu = belum ada data. Ketuk kartu KPI untuk definisi, rumus, dan target.</p>
        </InfoPop>
      </div>
      <div className="grid grid-cols-2 gap-space-xs sm:grid-cols-3 lg:grid-cols-4">
        {(kpi ?? []).map((k) => {
          const n = NADA[k.status]
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setBuka(k)}
              aria-label={`${k.label}: ${k.nilai}, target ${k.target}, ${n.label}`}
              className="relative flex min-h-24 flex-col gap-0.5 overflow-hidden rounded-md bg-surface-container-low py-space-xs pl-space-sm pr-space-xs text-left active:scale-[0.98]"
            >
              <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', n.garis)} />
              <span className="text-xs font-bold uppercase leading-tight text-on-surface-variant">{k.label}</span>
              <span className={cn('tabular text-numeric-lg font-bold', n.teks)}>{k.nilai}</span>
              <span className="text-xs text-on-surface-variant">Target {k.target}</span>
            </button>
          )
        })}
      </div>
      <Sheet open={!!buka} onOpenChange={(o) => !o && setBuka(null)} title={buka?.label ?? ''} description={buka ? `${buka.modul} · ${NADA[buka.status].label}` : ''}>
        {buka && (
          <div className="flex flex-col gap-space-sm pb-space-md text-body-md text-on-surface">
            <div className="flex items-baseline justify-between gap-space-sm rounded-md bg-surface-container-low p-space-sm">
              <span className={cn('tabular text-headline-md font-bold', NADA[buka.status].teks)}>{buka.nilai}</span>
              <span className="text-body-sm text-on-surface-variant">{buka.rincian}</span>
            </div>
            <dl className="flex flex-col gap-space-xs text-body-sm">
              {[
                ['Definisi', buka.definisi],
                ['Rumus', buka.rumus],
                ['Target', buka.target],
                ['Sumber data', buka.sumber],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-bold text-on-surface">{a}</dt>
                  <dd className="text-on-surface-variant">{b}</dd>
                </div>
              ))}
            </dl>
            <Link to={buka.ke} className={buttonVariants({ variant: 'glass' })}>
              Tindak lanjuti
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </Sheet>
    </GlassCard>
  )
}

const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))

/** KPI Operation, Delivery & Kualitas (Dashboard Operation). */
export function KpiOperation({ className }: { className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  const bulan = todayIso(now).slice(0, 7)
  const { recs: air } = useAir(`${bulan}-01`, akhirBulan(bulan))
  const { recs: ops } = useOps(`${bulan}-01`, akhirBulan(bulan))
  const kpi = useMemo(
    () =>
      app.loaded
        ? kpiOperation({
            bulan,
            now,
            daily: app.daily,
            reports: app.reports,
            plans: app.plans,
            rules: app.rules,
            tanks: TANKS,
            air,
            ops,
            formRawat: formKategori(app.role, app.settings, 'rawat'),
            formHk: formKategori(app.role, app.settings, 'hk'),
          })
        : null,
    [app.loaded, app.daily, app.reports, app.plans, app.rules, app.role, app.settings, air, ops, bulan, now],
  )
  return <KpiStrip judul="KPI Operation, Delivery & Kualitas" kpi={kpi} className={className} />
}

/** KPI Sales / Finance. */
export function KpiFinance({ className }: { className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  const bulan = todayIso(now).slice(0, 7)
  const { recs: closing } = useCatatan<ClosingData>('closing', `${bulan}-01`, akhirBulan(bulan))
  const { recs: totalizer } = useCatatan<TotalizerData>('totalizer', `${bulan}-01`, akhirBulan(bulan))
  const [petty, setPetty] = useState<PettyRecord[] | null>(null)
  useEffect(() => {
    // Pengajuan 2 bulan terakhir: settlement & realisasi bisa jatuh di bulan berikutnya.
    app.backend.listPetty(todayIso(addDays(new Date(`${bulan}-01T00:00:00`), -62)), akhirBulan(bulan)).then(setPetty, () => setPetty([]))
  }, [app.backend, app.spbuId, bulan])
  const kpi = useMemo(
    () => (app.loaded ? kpiFinance({ bulan, now, closing, totalizer, nozzles: app.settings.nozzles ?? [], petty, plafon: app.settings.pettyPlafon ?? 0 }) : null),
    [app.loaded, app.settings, closing, totalizer, petty, bulan, now],
  )
  return <KpiStrip judul="KPI Sales / Finance" kpi={kpi} className={className} />
}

/** KPI HSSE & Guard Patrol. */
export function KpiHsse({ className }: { className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  const bulan = todayIso(now).slice(0, 7)
  // Sampling guard tour hanya terbaca ABH, pengawas, dan security (RLS bbm_gts).
  const bacaGts = ['abh', 'pengawas', 'security'].includes(app.role ?? '')
  const [gts, setGts] = useState<GtsRecord[] | null>(null)
  useEffect(() => {
    if (!bacaGts) return
    app.backend.listGts(todayIso(addDays(now, -7)), todayIso(now)).then(setGts, () => setGts([]))
  }, [app.backend, app.spbuId, bacaGts, now])
  const kpi = useMemo(() => {
    if (!app.loaded) return null
    const kini = slotKini()
    let guardTour: { ok: number; total: number } | null = null
    if (bacaGts && gts) {
      guardTour = { ok: 0, total: 0 }
      for (let i = 0; i < 7; i++) {
        const t = todayIso(addDays(new Date(`${kini.tanggal}T00:00:00`), -6 + i))
        for (let s = 0; s < JUMLAH_SLOT; s++) {
          const st = statusSlot(t, s, gts, kini)
          if (st === 'nanti') continue
          guardTour.total++
          if (st === 'sudah') guardTour.ok++
        }
      }
    }
    return kpiHsse({
      bulan,
      now,
      apar: kondisiSemua(app.settings, app.daily.filter((d): d is AparRecord => d.kind === 'apar'), todayIso(now)),
      insiden: app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden'),
      henti: hentiDari(app.daily),
      guardTour,
    })
  }, [app.loaded, app.settings, app.daily, gts, bacaGts, bulan, now])
  return <KpiStrip judul="KPI HSSE & Guard Patrol" kpi={kpi} className={className} />
}
