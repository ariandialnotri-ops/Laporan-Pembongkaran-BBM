import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Target } from 'lucide-react'
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
import { kpiFinance, kpiHsse, kpiOperation, periodeSebelum, type Kpi, type ModulKpi, type Periode, type StatusKpi } from '@/lib/kpi'
import { formKategori } from '@/lib/ops'
import type { PettyRecord } from '@/lib/petty'
import { TANKS } from '@/lib/tank'
import type { TotalizerData } from '@/lib/totalizer'
import { useAir } from '@/lib/use-air'
import { useCatatan } from '@/lib/use-catatan'
import { useOps } from '@/lib/use-ops'
import { cn } from '@/lib/utils'

const NADA: Record<StatusKpi, { titik: string; teks: string; label: string }> = {
  ok: { titik: 'bg-emerald-500', teks: 'text-on-surface', label: 'Capai target' },
  pengingat: { titik: 'bg-amber-400', teks: 'text-amber-800', label: 'Mendekati target' },
  anomali: { titik: 'bg-error', teks: 'text-error', label: 'Di bawah target' },
  kosong: { titik: 'bg-outline-variant', teks: 'text-on-surface-variant', label: 'Belum ada data' },
}

/** Warna garis tren per status (palet status dataviz). */
const WARNA_TREN: Record<StatusKpi, string> = { ok: '#0ca30c', pengingat: '#d99000', anomali: '#d03b3b', kosong: '#9aa0a6' }

/** Bagi periode (sampai hari ini) menjadi ≤ 6 segmen berurutan untuk garis tren di kartu KPI. */
function segmenPeriode(p: Periode, n = 6): Periode[] {
  const akhir = p.sampai < todayIso() ? p.sampai : todayIso()
  const hari: string[] = []
  for (let t = p.dari; t <= akhir; t = todayIso(addDays(new Date(`${t}T00:00:00`), 1))) hari.push(t)
  const k = Math.min(n, hari.length)
  if (k < 2) return []
  const ukuran = Math.ceil(hari.length / k)
  const out: Periode[] = []
  for (let i = 0; i < hari.length; i += ukuran) out.push({ dari: hari[i], sampai: hari[Math.min(hari.length, i + ukuran) - 1] })
  return out
}

/** Garis tren mini (area bergradasi + titik akhir) di pojok kanan bawah kartu KPI; dekoratif, nilai ada di teks. */
function Sparkline({ seri, warna }: { seri: (number | null)[]; warna: string }) {
  const titik = seri.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null && Number.isFinite(x.v))
  if (!titik.length) return null
  // Satu titik data: garis datar (belum ada perubahan di dalam periode).
  if (titik.length === 1) {
    titik.unshift({ v: titik[0].v, i: 0 })
    titik[1].i = Math.max(1, seri.length - 1)
  }
  const W = 96
  const H = 28
  const min = Math.min(...titik.map((t) => t.v))
  const max = Math.max(...titik.map((t) => t.v))
  const x = (i: number) => 2 + (i / Math.max(1, seri.length - 1)) * (W - 6)
  const y = (v: number) => (max === min ? H / 2 : 3 + (1 - (v - min) / (max - min)) * (H - 8))
  const garis = titik.map((t, j) => `${j ? 'L' : 'M'}${x(t.i).toFixed(1)},${y(t.v).toFixed(1)}`).join(' ')
  const area = `${garis} L${x(titik[titik.length - 1].i).toFixed(1)},${H} L${x(titik[0].i).toFixed(1)},${H} Z`
  const akhir = titik[titik.length - 1]
  const id = `tren-${warna.slice(1)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-7 w-3/5 shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={warna} stopOpacity={0.28} />
          <stop offset="100%" stopColor={warna} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={garis} fill="none" stroke={warna} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(akhir.i)} cy={y(akhir.v)} r={3} fill="#fff" stroke={warna} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Perubahan terhadap periode sebelumnya (poin persen / menit); baik bila searah `arah`. */
function delta(k: Kpi, lalu: Kpi | undefined) {
  if (k.angka === null || !lalu || lalu.angka === null) return null
  const d = Math.round((k.angka - lalu.angka) * 10) / 10
  if (!d) return { d, baik: true }
  return { d, baik: k.arah === 'naik' ? d > 0 : d < 0 }
}

/** Pil perubahan ↗ 0,5 (hijau bila membaik, merah bila memburuk). */
function PilDelta({ k, lalu }: { k: Kpi; lalu?: Kpi }) {
  const x = delta(k, lalu)
  if (!x) return null
  const Ikon = x.d >= 0 ? ArrowUpRight : ArrowDownLeft
  return (
    <span className={cn('tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold', x.d === 0 ? 'bg-surface-container-high text-on-surface-variant' : x.baik ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      <Ikon aria-hidden="true" className="size-3" />
      {Math.abs(x.d).toLocaleString('id-ID')}
      {k.satuanDelta}
    </span>
  )
}

/** Kartu KPI gaya referensi: judul + chevron, angka, pil perubahan, rincian, dan garis tren di kanan bawah. */
function KartuKpi({ k, lalu, seri, onBuka }: { k: Kpi; lalu?: Kpi; seri: (number | null)[]; onBuka: () => void }) {
  const n = NADA[k.status]
  return (
    <button type="button" onClick={onBuka} aria-label={`${k.label}: ${k.nilai}, target ${k.target}, ${n.label}`} className="flex min-h-28 flex-col gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-space-sm text-left shadow-sm active:scale-[0.98]">
      <span className="flex items-start gap-1">
        <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.titik)} />
        <span className="min-w-0 flex-1 text-body-sm font-semibold leading-snug text-on-surface">{k.label}</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={cn('tabular text-[22px] font-bold leading-tight tracking-tight', n.teks)}>{k.nilai}</span>
        <PilDelta k={k} lalu={lalu} />
      </span>
      <span className="text-xs leading-snug text-on-surface-variant">{k.rincian}</span>
      <span className="mt-auto flex justify-end pt-0.5">
        <Sparkline seri={seri} warna={WARNA_TREN[k.status]} />
      </span>
    </button>
  )
}

const URUT_MODUL: ModulKpi[] = ['Operation', 'Kualitas', 'Delivery', 'Finance', 'HSSE']

/**
 * Panel KPI: ringkasan capaian, lalu satu dropdown per modul (yang perlu perhatian terbuka lebih dulu) berisi
 * kartu KPI 2 kolom. Ketuk kartu untuk definisi, rumus, target, dan tindak lanjut.
 */
export function KpiPanel({ judul, kpi, lalu, tren, className }: { judul: string; kpi: Kpi[] | null; lalu?: Kpi[] | null; tren?: Kpi[][] | null; className?: string }) {
  const [detail, setDetail] = useState<Kpi | null>(null)
  const grup = URUT_MODUL.map((m) => ({ m, isi: (kpi ?? []).filter((k) => k.modul === m) })).filter((g) => g.isi.length)
  // Bawaan: modul pertama yang punya KPI merah terbuka; sisanya ringkas (tidak menumpuk).
  const awal = grup.find((g) => g.isi.some((k) => k.status === 'anomali'))?.m ?? grup[0]?.m
  const [buka, setBuka] = useState<Set<ModulKpi> | null>(null)
  const terbuka = buka ?? new Set(awal ? [awal] : [])
  const capai = kpi?.filter((k) => k.status === 'ok').length ?? 0
  const dinilai = kpi?.filter((k) => k.status !== 'kosong').length ?? 0
  const lalu1 = (id: string) => lalu?.find((x) => x.id === id)
  const seri = (id: string) => (tren ?? []).map((t) => t.find((x) => x.id === id)?.angka ?? null)
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', className)}>
      <div className="flex items-center gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
          <Target className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">{judul}</span>
          <span className="text-body-sm text-on-surface-variant">{kpi === null ? 'Menghitung…' : `${capai} dari ${dinilai} KPI capai target`}</span>
        </div>
        {kpi !== null && dinilai > 0 && (
          <span className="relative flex size-12 shrink-0 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="absolute size-12 -rotate-90">
              <circle cx={18} cy={18} r={15} fill="none" stroke="#eef0f4" strokeWidth={4} />
              <circle cx={18} cy={18} r={15} fill="none" stroke="#0ca30c" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(capai / dinilai) * 94.2} 94.2`} />
            </svg>
            <span className="tabular text-xs font-bold text-on-surface">{Math.round((capai / dinilai) * 100)}%</span>
          </span>
        )}
        <InfoPop judul="Model KPI">
          <p>KPI dihitung otomatis dari data aplikasi untuk periode yang dipilih, dibanding target dan periode sebelumnya (pil ↗/↙: hijau membaik, merah memburuk). Garis kecil di kanan bawah kartu = tren nilai KPI di dalam periode (dibagi ≤ 6 bagian).</p>
          <p>Titik hijau = capai target, amber = mendekati, merah = di bawah target, abu-abu = belum ada data. Ketuk kartu untuk definisi, rumus, target, dan tindak lanjut.</p>
        </InfoPop>
      </div>
      {grup.map(({ m, isi }) => {
        const on = terbuka.has(m)
        const merah = isi.filter((k) => k.status === 'anomali').length
        const ok = isi.filter((k) => k.status === 'ok').length
        return (
          <div key={m} className="flex flex-col overflow-hidden rounded-lg bg-surface-container-low">
            <button
              type="button"
              aria-expanded={on}
              onClick={() =>
                setBuka(() => {
                  const y = new Set(terbuka)
                  if (y.has(m)) y.delete(m)
                  else y.add(m)
                  return y
                })
              }
              className="flex min-h-12 items-center gap-space-sm px-space-sm text-left"
            >
              <span className="flex-1 text-body-md font-bold text-on-surface">{m}</span>
              <span className="flex gap-1" aria-hidden="true">
                {isi.map((k) => (
                  <span key={k.id} className={cn('size-2 rounded-full', NADA[k.status].titik)} />
                ))}
              </span>
              <span className={cn('tabular text-body-sm font-semibold', merah ? 'text-error' : 'text-on-surface-variant')}>
                {ok}/{isi.length}
              </span>
              <ChevronDown aria-hidden="true" className={cn('size-5 text-on-surface-variant transition-transform', on && 'rotate-180')} />
            </button>
            {on && (
              <div className="grid grid-cols-2 gap-space-xs px-space-xs pb-space-xs sm:grid-cols-3 lg:grid-cols-4">
                {isi.map((k) => (
                  <KartuKpi key={k.id} k={k} lalu={lalu1(k.id)} seri={seri(k.id)} onBuka={() => setDetail(k)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail?.label ?? ''} description={detail ? `${detail.modul} · ${NADA[detail.status].label}` : ''}>
        {detail && (
          <div className="flex flex-col gap-space-sm pb-space-md text-body-md text-on-surface">
            <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-md bg-surface-container-low p-space-sm">
              <span className="flex items-center gap-2">
                <span className={cn('tabular text-headline-md font-bold', NADA[detail.status].teks)}>{detail.nilai}</span>
                <PilDelta k={detail} lalu={lalu1(detail.id)} />
              </span>
              <span className="text-body-sm text-on-surface-variant">{detail.rincian}</span>
            </div>
            {lalu1(detail.id) && lalu1(detail.id)!.angka !== null && <span className="text-body-sm text-on-surface-variant">Periode sebelumnya: {lalu1(detail.id)!.nilai}</span>}
            <dl className="flex flex-col gap-space-xs text-body-sm">
              {[
                ['Definisi', detail.definisi],
                ['Rumus', detail.rumus],
                ['Target', detail.target],
                ['Sumber data', detail.sumber],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-bold text-on-surface">{a}</dt>
                  <dd className="text-on-surface-variant">{b}</dd>
                </div>
              ))}
            </dl>
            <Link to={detail.ke} className={buttonVariants({ variant: 'glass' })}>
              Tindak lanjuti
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </Sheet>
    </GlassCard>
  )
}

/** KPI Operation, Delivery & Kualitas (Dashboard Operation), periode terpilih vs sebelumnya. */
export function KpiOperation({ periode, className }: { periode: Periode; className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  const lalu = periodeSebelum(periode)
  const { recs: air } = useAir(lalu.dari, periode.sampai)
  const { recs: ops } = useOps(lalu.dari, periode.sampai)
  const hitung = (p: Periode) =>
    kpiOperation({
      periode: p,
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
  const kini = app.loaded ? hitung(periode) : null
  const sebelum = app.loaded ? hitung(lalu) : null
  const tren = app.loaded ? segmenPeriode(periode).map(hitung) : null
  return <KpiPanel judul="KPI Operation, Delivery & Kualitas" kpi={kini} lalu={sebelum} tren={tren} className={className} />
}

/** KPI Sales / Finance, periode terpilih vs sebelumnya. */
export function KpiFinance({ periode, className }: { periode: Periode; className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  const lalu = periodeSebelum(periode)
  const { recs: closing } = useCatatan<ClosingData>('closing', lalu.dari, periode.sampai)
  const { recs: totalizer } = useCatatan<TotalizerData>('totalizer', lalu.dari, periode.sampai)
  const [petty, setPetty] = useState<{ kunci: string; recs: PettyRecord[] } | null>(null)
  const kunci = `${app.spbuId}|${lalu.dari}|${periode.sampai}`
  useEffect(() => {
    // Pengajuan 2 bulan sebelum periode: settlement & realisasi bisa jatuh setelahnya.
    app.backend.listPetty(todayIso(addDays(new Date(`${lalu.dari}T00:00:00`), -62)), periode.sampai).then(
      (recs) => setPetty({ kunci, recs }),
      () => setPetty({ kunci, recs: [] }),
    )
  }, [app.backend, kunci, lalu.dari, periode.sampai])
  const pr = petty?.kunci === kunci ? petty.recs : null
  const hitung = (p: Periode) => kpiFinance({ periode: p, now, closing, totalizer, nozzles: app.settings.nozzles ?? [], petty: pr, plafon: app.settings.pettyPlafon ?? 0 })
  return <KpiPanel judul="KPI Sales / Finance" kpi={app.loaded ? hitung(periode) : null} lalu={app.loaded ? hitung(lalu) : null} tren={app.loaded ? segmenPeriode(periode).map(hitung) : null} className={className} />
}

/** KPI HSSE & Guard Patrol, periode terpilih vs sebelumnya. */
export function KpiHsse({ periode, className }: { periode: Periode; className?: string }) {
  const app = useApp()
  const now = useMemo(() => new Date(), [])
  // Sampling guard tour hanya terbaca ABH, pengawas, dan security (RLS bbm_gts).
  const bacaGts = ['abh', 'pengawas', 'security'].includes(app.role ?? '')
  const [gts, setGts] = useState<GtsRecord[] | null>(null)
  useEffect(() => {
    if (!bacaGts) return
    app.backend.listGts(todayIso(addDays(now, -7)), todayIso(now)).then(setGts, () => setGts([]))
  }, [app.backend, app.spbuId, bacaGts, now])
  const hitung = (p: Periode) => {
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
      periode: p,
      now,
      apar: kondisiSemua(app.settings, app.daily.filter((d): d is AparRecord => d.kind === 'apar'), todayIso(now)),
      insiden: app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden'),
      henti: hentiDari(app.daily),
      guardTour,
    })
  }
  return <KpiPanel judul="KPI HSSE & Guard Patrol" kpi={app.loaded ? hitung(periode) : null} lalu={app.loaded ? hitung(periodeSebelum(periode)) : null} tren={app.loaded ? segmenPeriode(periode).map(hitung) : null} className={className} />
}
