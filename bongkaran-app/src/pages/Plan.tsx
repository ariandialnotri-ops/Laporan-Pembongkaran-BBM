import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, CalendarDays, ChevronRight, CircleCheck, Lock, Plus, Send, Trash2 } from 'lucide-react'
import { DateFilter, inRangeOrUpcoming, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { ErrorBox, ProdukSelect, SupplySelect } from '@/components/bongkaran/lo-fields'
import { LogoProduk } from '@/components/bongkaran/logo-produk'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { belumTerbit, LO_MAX_LITER, LO_STATUS, loStatus, loStatusMeta, pecahVolume, planBesokKurang, planSupply, SHIFT_PERMINTAAN, type LoDisplayStatus } from '@/lib/plan'
import { PRODUK_OPTIONS, SUPPLY_POINTS, type Plan as PlanT, type PlanLo } from '@/lib/sop'
import { useKeTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

type Row = { id: string; produk: string; volume: string; shift: '' | '1' | '2' | '3' }
const blankRow = (shift: Row['shift'] = '', produk = PRODUK_OPTIONS[0]): Row => ({ id: genId('lo'), produk, volume: '8000', shift })

type PlanForm = Pick<PlanT, 'tanggal' | 'ms2Tanggal' | 'ms2Jam' | 'ms2Shift' | 'poSap' | 'shipTo' | 'supplyPoint' | 'noSO'>
const blankPlanForm = (tanggal = todayIso()): PlanForm => ({
  tanggal,
  ms2Tanggal: todayIso(),
  ms2Jam: '',
  ms2Shift: '',
  poSap: '',
  shipTo: '',
  supplyPoint: SUPPLY_POINTS[0],
  noSO: '',
})

type TRow = { plan: PlanT; lo: PlanLo; status: LoDisplayStatus }

/** Titik status berdenyut untuk LO yang sedang berjalan (planned / dalam pengiriman). */
const BERJALAN: LoDisplayStatus[] = ['planned', 'delivery']

/**
 * Kartu satu LO (gaya "Status Pengiriman Terakhir" aplikasi MyPertamina): logo produk di kiri, nomor LO
 * + volume (KL), tanggal & shift planning, SO & supply point, realisasi bongkar (hijau) dan status di kanan.
 * Ketuk untuk detail LO (stepper, riwayat, edit/update).
 */
function KartuLo({ x, urut, sorot, onBuka }: { x: TRow; urut: number; sorot: boolean; onBuka: () => void }) {
  const app = useApp()
  const meta = loStatusMeta(x.status)
  const report = app.usedLoIds.get(x.lo.id)
  const belum = belumTerbit(x.plan, x.lo)
  const shift = x.lo.shift || x.plan.ms2Shift
  return (
    <li className="kartu-lo min-w-0" style={{ animationDelay: `${Math.min(urut, 10) * 45}ms` }}>
      <button
        type="button"
        onClick={onBuka}
        aria-label={`Detail LO ${x.lo.noLO || 'belum terbit'} ${x.lo.produk}`}
        className={cn(
          'group flex w-full items-stretch gap-space-sm rounded-2xl border bg-surface-container-lowest p-space-sm text-left shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          sorot ? 'border-primary/50 bg-primary-fixed/40' : belum ? 'border-orange-200 bg-orange-50/70 shadow-[inset_4px_0_0_#f97316]' : 'border-outline-variant/40',
        )}
      >
        <LogoProduk produk={x.lo.produk} className="h-16 w-20 self-center sm:h-[4.5rem] sm:w-24 transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            {x.lo.noLO ? (
              <span className="tabular whitespace-nowrap text-body-lg font-bold text-on-surface">LO {x.lo.noLO}</span>
            ) : (
              <span className="whitespace-nowrap text-body-lg font-bold italic text-orange-700">LO belum terbit</span>
            )}
            <span className="tabular whitespace-nowrap text-body-sm font-semibold text-on-surface-variant">({formatNumber(x.lo.volume / 1000)} KL)</span>
          </span>
          {x.lo.noLOLama && (
            <span className="tabular inline-flex items-center gap-1 text-xs text-on-surface-variant">
              dari <s>{x.lo.noLOLama}</s>
            </span>
          )}
          <span className="tabular flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-body-sm text-on-surface">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="whitespace-nowrap">Planning {formatTanggalIso(x.plan.tanggal)}</span>
            {shift && <span className="rounded-md bg-primary/10 px-1.5 text-xs font-bold text-primary">Shift {shift}</span>}
          </span>
          <span className="tabular truncate text-xs text-on-surface-variant">
            SO {x.plan.noSO || 'belum terbit'} · {planSupply(x.plan, x.lo) || '-'}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-space-sm gap-y-1">
            <Pill tone={meta.tone} className="shrink-0">
              {BERJALAN.includes(x.status) && (
                <span aria-hidden="true" className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-current" />
                </span>
              )}
              {x.status === 'closed' && <Lock aria-hidden="true" />}
              {meta.label}
            </Pill>
            {report && (
              <span className="tabular flex items-center gap-1 text-body-sm font-semibold text-emerald-700">
                <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                Realisasi {formatTanggalIso(report.tanggal)}
                {report.jam ? `, ${report.jam.replace(':', '.')}` : ''}
              </span>
            )}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-on-surface-variant transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </button>
    </li>
  )
}

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Kolom data permintaan MS2: dipakai di form baru dan sheet edit. */
function PlanFields({ form, set, idp }: { form: PlanForm; set: (p: Partial<PlanForm>) => void; idp: string }) {
  return (
    <div className="grid grid-cols-2 gap-space-sm">
      <Field label="Tanggal kirim" htmlFor={`${idp}-tgl`}>
        <Input id={`${idp}-tgl`} type="date" value={form.tanggal} onChange={(e) => set({ tanggal: e.target.value })} />
      </Field>
      <Field label="Supply point" htmlFor={`${idp}-sp`}>
        <SupplySelect id={`${idp}-sp`} value={form.supplyPoint} onChange={(v) => set({ supplyPoint: v })} />
      </Field>
      <Field label="Tanggal permintaan MS2" htmlFor={`${idp}-ms2t`}>
        <Input id={`${idp}-ms2t`} type="date" value={form.ms2Tanggal} onChange={(e) => set({ ms2Tanggal: e.target.value })} />
      </Field>
      <Field label="Jam permintaan MS2" htmlFor={`${idp}-ms2j`}>
        <Input id={`${idp}-ms2j`} type="time" value={form.ms2Jam} onChange={(e) => set({ ms2Jam: e.target.value })} />
      </Field>
      <Field label="No. Ship To" htmlFor={`${idp}-ship`}>
        <Input id={`${idp}-ship`} autoComplete="off" inputMode="numeric" placeholder="otomatis dari Profil" value={form.shipTo} onChange={(e) => set({ shipTo: e.target.value })} />
      </Field>
      <Field label="No. PO SAP" htmlFor={`${idp}-po`}>
        <Input id={`${idp}-po`} autoComplete="off" placeholder="opsional" value={form.poSap} onChange={(e) => set({ poSap: e.target.value })} />
      </Field>
    </div>
  )
}

function validatePlan(f: PlanForm) {
  if (!f.tanggal) return 'Isi tanggal kirim.'
  if (!f.ms2Tanggal || !f.ms2Jam) return 'Isi tanggal dan jam permintaan lewat MS2.'
  if (!f.supplyPoint) return 'Pilih supply point.'
  if (!f.shipTo.trim()) return 'Isi nomor Ship To.'
  return null
}

export function Plan() {
  const app = useApp()
  const navigate = useNavigate()
  // Permintaan yang baru disimpan / SO-LO yang baru diubah disorot biru.
  const [params] = useSearchParams()
  const sorot = params.get('baru')
  const [notifBisa, setNotifBisa] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'default')
  const [range, setRange] = useDateRange('7d')
  const [statusFilter, setStatusFilter] = useState<LoDisplayStatus | null>(null)

  useSyncOnOpen()
  const used = app.usedLoIds
  const inDate = useMemo(() => app.plans.filter((p) => inRangeOrUpcoming(p.tanggal, range)), [app.plans, range])
  // Dashboard SO & LO per status, mengikuti filter tanggal.
  const counts = useMemo(() => {
    const c = new Map<LoDisplayStatus, number>()
    inDate.forEach((p) =>
      p.los.forEach((lo) => {
        const k = loStatus(lo, used)
        c.set(k, (c.get(k) ?? 0) + 1)
      }),
    )
    return c
  }, [inDate, used])
  const soTerbit = inDate.filter((p) => p.noSO.trim()).length
  const besok = planBesokKurang(app.plans)

  // Plan & Tracking LO satu halaman: ketuk LO untuk stepper tahap pengiriman (edit/update dari sana).
  const bukaLo = (plan: PlanT, lo: PlanLo) => navigate(`/plan/lo/${encodeURIComponent(plan.id)}/${encodeURIComponent(lo.id)}`)
  const bolehBuat = app.can('/plan/baru')


  const visible = inDate
    .filter((p) => !statusFilter || p.los.some((lo) => loStatus(lo, used) === statusFilter))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.createdAt - a.createdAt)
  const tabel: TRow[] = visible.flatMap((plan) => plan.los.filter((lo) => !statusFilter || loStatus(lo, used) === statusFilter).map((lo) => ({ plan, lo, status: loStatus(lo, used) })))

  return (
    <div className="flex flex-col gap-space-md">
      {besok && bolehBuat && (
        <div role="status" className="animate-entrance-1 flex flex-col gap-space-sm rounded-lg border border-amber-300 bg-amber-50 p-space-md">
          <div className="flex items-start gap-space-sm">
            <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="flex flex-col">
              <span className="text-body-md font-bold text-on-surface">Plan pengiriman besok belum dibuat</span>
              <span className="text-body-sm text-on-surface-variant">Pengingat harian pukul 06:00 untuk kiriman {formatTanggalIso(besok)}.</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <Link to={`/plan/baru?tanggal=${besok}`} className={buttonVariants({ size: 'pill' })}>
              <Plus aria-hidden="true" />
              Buat plan besok
            </Link>
            {notifBisa && (
              <Button variant="glass" size="pill" onClick={() => void Notification.requestPermission().then(() => setNotifBisa(false))}>
                Aktifkan notifikasi
              </Button>
            )}
          </div>
        </div>
      )}

      {bolehBuat && (
        <Link to="/plan/baru" className={cn(buttonVariants({ size: 'lg' }), 'animate-entrance-1 w-full')}>
          <Plus aria-hidden="true" />
          Permintaan baru (MS2)
        </Link>
      )}

      {/* Dashboard SO & LO per status */}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-headline-md font-bold text-on-surface">Status SO & LO</h2>
          <span className="tabular text-body-sm text-on-surface-variant">
            {soTerbit}/{inDate.length} SO terbit
          </span>
        </div>
        <DateFilter id="plan-range" value={range} onChange={setRange} />
        <div className="grid grid-cols-4 gap-space-xs">
          {LO_STATUS.map((s) => {
            const n = counts.get(s.key) ?? 0
            const active = statusFilter === s.key
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                aria-label={`${s.label}: ${n} LO. ${s.desc}`}
                onClick={() => setStatusFilter(active ? null : s.key)}
                className={cn(
                  'flex min-h-16 flex-col items-start justify-between rounded-md p-space-xs text-left transition-colors duration-200 active:scale-[0.98]',
                  active ? 'bg-primary text-on-primary' : 'bg-surface-container-low/80 text-on-surface',
                )}
              >
                <span className="text-tag uppercase leading-tight">{s.label}</span>
                <span className="tabular text-numeric-md font-bold">{n}</span>
              </button>
            )
          })}
        </div>
        {statusFilter && (
          <span className="text-body-sm text-on-surface-variant">
            LO berstatus <b className="text-on-surface">{loStatusMeta(statusFilter).label}</b>: {loStatusMeta(statusFilter).desc.toLowerCase()}.
          </span>
        )}
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-sm bg-orange-50 shadow-[inset_3px_0_0_#f97316] ring-1 ring-orange-200" />
          Kartu oranye: SO/LO belum terbit dari depot.
        </span>
      </GlassCard>

      <section aria-labelledby="judul-lo" className="animate-entrance-2 flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-center gap-space-sm px-space-2xs">
          <h2 id="judul-lo" className="text-body-md font-bold uppercase tracking-wide text-on-surface">
            Status pengiriman LO
          </h2>
          <span className="tabular rounded-full border border-primary/30 bg-primary-fixed/60 px-3 py-0.5 text-body-sm font-semibold text-primary">
            {tabel.length} dari {app.plans.reduce((n, p) => n + p.los.length, 0)}
          </span>
          {app.settings.kodeSpbu && <span className="tabular ml-auto text-body-sm text-on-surface-variant">SPBU {app.settings.kodeSpbu}</span>}
        </div>
        {tabel.length ? (
          <ul className="grid gap-space-sm lg:grid-cols-2">
            {tabel.map((x, i) => (
              <KartuLo key={x.lo.id} x={x} urut={i} sorot={x.plan.id === sorot} onBuka={() => bukaLo(x.plan, x.lo)} />
            ))}
          </ul>
        ) : (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            {statusFilter ? 'Tidak ada LO dengan status ini pada rentang tanggal terpilih.' : 'Belum ada plan pengiriman pada rentang tanggal ini.'}
          </GlassCard>
        )}
      </section>
    </div>
  )
}

/** Delivery > Plan Pengiriman > Permintaan baru (MS2): halaman form tersendiri. */
export function PlanBaru() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const [params] = useSearchParams()
  const [form, setForm] = useState<PlanForm>(() => blankPlanForm(params.get('tanggal') || todayIso()))
  const [rows, setRows] = useState<Row[]>(() => [blankRow()])
  const [error, setError] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari permintaan baru?', detail: 'Permintaan MS2 yang belum dikirim akan hilang.' })

  const simpan = async () => {
    if (menyimpan) return
    const valid = rows.filter((r) => (parseAngka(r.volume) ?? 0) > 0)
    // Ship To kosong: pakai Ship To produk pertama dari Profil > Sold To & Ship To.
    const shipToProfil = valid[0] ? app.settings.shipTo?.[valid[0].produk] : ''
    const f = { ...form, shipTo: form.shipTo.trim() || shipToProfil || '' }
    const err = validatePlan(f)
    if (err) return setError(err)
    if (!valid.length) return setError('Isi minimal satu produk dengan volume lebih dari 0 liter.')
    const tanpaShift = valid.findIndex((r) => !r.shift)
    const volumeRow = (r: Row) => parseAngka(r.volume) ?? 0
    if (tanpaShift >= 0) return setError(`Pilih shift permintaan untuk produk ${rows.indexOf(valid[tanpaShift]) + 1} (${valid[tanpaShift].produk}).`)
    const plan: PlanT = {
      id: genId('plan'),
      createdAt: Date.now(),
      ...f,
      // Shift permintaan diisi per produk; shift plan = shift produk pertama (data lama/SLA).
      ms2Shift: valid[0].shift,
      shipTo: f.shipTo.trim(),
      poSap: f.poSap.trim(),
      soldTo: app.settings.soldTo ?? '',
      noSO: '',
      produk: '',
      // Tiap 8.000 L = 1 LO: 16.000 L menjadi 2 LO, 20.000 L menjadi 8.000 + 8.000 + 4.000.
      los: valid.flatMap((r) => pecahVolume(volumeRow(r)).map((volume, i) => ({ id: i ? genId('lo') : r.id, noLO: '', produk: r.produk, volume, shift: r.shift, status: 'os' as const, segel: [] }))),
    }
    setError(null)
    setMenyimpan(true)
    try {
      await app.savePlan(plan)
      guard.bypass()
      keTerkirim({
        judul: 'Permintaan MS2 terkirim',
        detail: `Kirim ${formatTanggalIso(plan.tanggal)}, ${plan.supplyPoint}. Isi nomor SO & LO di Plan Pengiriman saat sudah terbit.`,
        baris: [
          ...valid.map((r): [string, string] => [r.produk, `${formatNumber(volumeRow(r))} L · shift ${r.shift}`]),
          ['Jumlah LO', `${plan.los.length} LO`],
          ['Permintaan MS2', `${formatTanggalIso(plan.ms2Tanggal)} ${plan.ms2Jam}`],
        ],
        aksi: [
          { to: `/plan?baru=${encodeURIComponent(plan.id)}`, label: 'Lihat Plan Pengiriman' },
          { to: '/plan/baru', label: 'Buat permintaan lain' },
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setMenyimpan(false)
    }
  }


  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <span className="text-body-sm text-on-surface-variant">Nomor SO dan LO diisi dari daftar plan setelah terbit dari depot.</span>
        <PlanFields idp="plan" form={form} set={(p) => setForm({ ...form, ...p })} />
        <div className="flex flex-col gap-space-xs">
          <span className="text-tag uppercase text-on-surface-variant">Produk yang diminta</span>
          {rows.map((r, i) => {
            const setRow = (p: Partial<Row>) => setRows(rows.map((x) => (x.id === r.id ? { ...x, ...p } : x)))
            return (
              <div key={r.id} className="flex flex-col gap-space-xs rounded-md bg-surface-container-low/60 p-space-xs">
                <div className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-space-xs">
                  <ProdukSelect id={`plan-row-${i}`} label={`Produk ${i + 1}`} value={r.produk} onChange={(v) => setRow({ produk: v })} />
                  <Input aria-label={`Volume produk ${i + 1}`} numeric inputMode="numeric" suffix="L" value={r.volume} onChange={(e) => setRow({ volume: e.target.value })} />
                  <Button variant="ghost" size="icon" aria-label={`Hapus produk ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <Choice label={`Shift permintaan produk ${i + 1}`} value={r.shift} onChange={(v) => setRow({ shift: v })} options={SHIFT_PERMINTAAN} />
                <JumlahLo volume={parseAngka(r.volume) ?? 0} />
              </div>
            )
          })}
          <Button variant="soft" size="sm" className="self-start" onClick={() => setRows([...rows, blankRow(rows.at(-1)?.shift)])}>
            <Plus aria-hidden="true" />
            Tambah produk
          </Button>
        </div>
        <ErrorBox text={error} />
        <Button size="lg" disabled={menyimpan} onClick={simpan}>
          <Send aria-hidden="true" />
          {menyimpan ? 'Mengirim…' : 'Kirim permintaan'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Pratinjau pemecahan volume permintaan: tiap 8.000 L = 1 LO. */
function JumlahLo({ volume }: { volume: number }) {
  const bagian = pecahVolume(volume)
  if (!bagian.length) return null
  return (
    <span className="tabular text-body-sm text-on-surface-variant">
      = <b className="text-on-surface">{bagian.length} LO</b>
      {bagian.length > 1 ? ` (${bagian.map((v) => formatNumber(v)).join(' + ')} L)` : ''}, maks. {formatNumber(LO_MAX_LITER)} L per LO
    </span>
  )
}
