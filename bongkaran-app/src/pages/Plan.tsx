import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardList, Lock, Plus, Trash2 } from 'lucide-react'
import { DateFilter, inRangeOrUpcoming, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { ErrorBox, ProdukSelect, SupplySelect } from '@/components/bongkaran/lo-fields'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { LO_MAX_LITER, LO_STATUS, loStatus, loStatusMeta, pecahVolume, planBesokKurang, planSupply, SHIFT_PERMINTAAN, type LoDisplayStatus } from '@/lib/plan'
import { PRODUK_OPTIONS, SUPPLY_POINTS, type Plan as PlanT, type PlanLo } from '@/lib/sop'
import { cn } from '@/lib/utils'

type Row = { id: string; produk: string; volume: string; shift: '' | '1' | '2' }
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

/** Tabel plan pengiriman: satu baris per LO, ketuk untuk membuka halaman Edit SO & LO. */
const COLS: Col<TRow>[] = [
  { header: 'Tgl kirim', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.plan.tanggal)}</span>, mobileCell: (x) => `Kirim ${formatTanggalIso(x.plan.tanggal)}`, mobile: 'sub' },
  { header: 'No SO', cell: (x) => <span className="tabular whitespace-nowrap">{x.plan.noSO || <span className="italic text-on-surface-variant">belum terbit</span>}</span>, mobile: 'hide' },
  {
    header: 'No LO',
    cell: (x) =>
      x.lo.noLOLama ? (
        <span className="tabular inline-flex items-center gap-1 whitespace-nowrap">
          <s className="text-on-surface-variant">{x.lo.noLOLama}</s>
          <ArrowRight aria-label="menjadi" className="size-3.5" />
          {x.lo.noLO}
        </span>
      ) : (
        <span className="tabular whitespace-nowrap">{x.lo.noLO || <span className="italic text-on-surface-variant">belum terbit</span>}</span>
      ),
    mobileCell: (x) => (x.lo.noLO ? `LO ${x.lo.noLO}` : `${x.lo.produk}, LO belum terbit`),
    mobile: 'title',
  },
  { header: 'SO', cell: (x) => `SO ${x.plan.noSO || 'belum terbit'}`, mobile: 'sub', desktop: false },
  { header: 'Produk', cell: (x) => <ProdukChip produk={x.lo.produk} />, mobile: 'hide' },
  { header: 'Volume (L)', cell: (x) => formatNumber(x.lo.volume), align: 'right', mobile: 'hide' },
  { header: 'Shift', cell: (x) => <span className="tabular">{x.lo.shift || x.plan.ms2Shift || '-'}</span>, mobile: 'hide' },
  { header: 'Produk & volume', cell: (x) => `${x.lo.produk}, ${formatNumber(x.lo.volume)} L${x.lo.shift ? `, shift ${x.lo.shift}` : ''}`, mobile: 'sub', desktop: false },
  { header: 'Supply point', cell: (x) => <span className="whitespace-nowrap">{planSupply(x.plan, x.lo) || '-'}</span>, mobile: 'hide' },
  {
    header: 'Permintaan MS2',
    cell: (x) => (
      <span className="tabular whitespace-nowrap text-on-surface-variant">
        {formatTanggalIso(x.plan.ms2Tanggal)} {x.plan.ms2Jam}
      </span>
    ),
    mobile: 'hide',
  },
  {
    header: 'Status',
    cell: (x) => {
      const m = loStatusMeta(x.status)
      return (
        <Pill tone={m.tone}>
          {x.status === 'closed' && <Lock aria-hidden="true" />}
          {m.label}
        </Pill>
      )
    },
    mobile: 'badge',
  },
]

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
        <Input id={`${idp}-ship`} autoComplete="off" inputMode="numeric" value={form.shipTo} onChange={(e) => set({ shipTo: e.target.value })} />
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
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState<PlanForm>(() => blankPlanForm())
  const [rows, setRows] = useState<Row[]>(() => [blankRow()])
  const [error, setError] = useState<string | null>(null)
  const [baru, setBaru] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)
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

  const simpan = async () => {
    if (menyimpan) return
    const err = validatePlan(form)
    if (err) return setError(err)
    const valid = rows.filter((r) => (parseAngka(r.volume) ?? 0) > 0)
    if (!valid.length) return setError('Isi minimal satu produk dengan volume lebih dari 0 liter.')
    const tanpaShift = valid.findIndex((r) => !r.shift)
    const volumeRow = (r: Row) => parseAngka(r.volume) ?? 0
    if (tanpaShift >= 0) return setError(`Pilih shift permintaan untuk produk ${rows.indexOf(valid[tanpaShift]) + 1} (${valid[tanpaShift].produk}).`)
    const plan: PlanT = {
      id: genId('plan'),
      createdAt: Date.now(),
      ...form,
      // Shift permintaan diisi per produk; shift plan = shift produk pertama (data lama/SLA).
      ms2Shift: valid[0].shift,
      shipTo: form.shipTo.trim(),
      poSap: form.poSap.trim(),
      noSO: '',
      produk: '',
      soldTo: '',
      // Tiap 8.000 L = 1 LO: 16.000 L menjadi 2 LO, 20.000 L menjadi 8.000 + 8.000 + 4.000.
      los: valid.flatMap((r) => pecahVolume(volumeRow(r)).map((volume, i) => ({ id: i ? genId('lo') : r.id, noLO: '', produk: r.produk, volume, shift: r.shift, status: 'os' as const, segel: [] }))),
    }
    setError(null)
    setMenyimpan(true)
    try {
      await app.savePlan(plan)
      setForm(blankPlanForm(form.tanggal))
      setRows([blankRow()])
      setBaru(false)
      toast(`Permintaan tersimpan: ${plan.los.length} LO. Isi SO & LO di daftar saat sudah terbit.`)
    } catch (e) {
      setError(pesan(e))
    } finally {
      setMenyimpan(false)
    }
  }


  const bukaLo = (plan: PlanT, lo: PlanLo) => navigate(`/plan/so/${encodeURIComponent(plan.id)}?lo=${encodeURIComponent(lo.id)}`)


  const visible = inDate
    .filter((p) => !statusFilter || p.los.some((lo) => loStatus(lo, used) === statusFilter))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.createdAt - a.createdAt)
  const tabel: TRow[] = visible.flatMap((plan) => plan.los.filter((lo) => !statusFilter || loStatus(lo, used) === statusFilter).map((lo) => ({ plan, lo, status: loStatus(lo, used) })))

  return (
    <div className="flex flex-col gap-space-md">
      {besok && (
        <div role="status" className="animate-entrance-1 flex flex-col gap-space-sm rounded-lg border border-amber-300 bg-amber-50 p-space-md">
          <div className="flex items-start gap-space-sm">
            <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="flex flex-col">
              <span className="text-body-md font-bold text-on-surface">Plan pengiriman besok belum dibuat</span>
              <span className="text-body-sm text-on-surface-variant">Pengingat harian pukul 06:00 untuk kiriman {formatTanggalIso(besok)}.</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <Button
              size="pill"
              onClick={() => {
                setForm(blankPlanForm(besok))
                setBaru(true)
              }}
            >
              <Plus aria-hidden="true" />
              Buat plan besok
            </Button>
            {notifBisa && (
              <Button variant="glass" size="pill" onClick={() => void Notification.requestPermission().then(() => setNotifBisa(false))}>
                Aktifkan notifikasi
              </Button>
            )}
          </div>
        </div>
      )}

      <Button size="lg" className="animate-entrance-1 w-full" onClick={() => setBaru(true)}>
        <Plus aria-hidden="true" />
        Permintaan baru (MS2)
      </Button>

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
      </GlassCard>

      <div className="animate-entrance-2">
        <RecordTable
          title="Plan Pengiriman"
          rows={tabel}
          total={app.plans.reduce((n, p) => n + p.los.length, 0)}
          cols={COLS}
          rowKey={(x) => x.lo.id}
          onRow={(x) => bukaLo(x.plan, x.lo)}
          empty={statusFilter ? 'Tidak ada LO dengan status ini pada rentang tanggal terpilih.' : 'Belum ada plan pengiriman pada rentang tanggal ini.'}
        />
      </div>

      {/* Permintaan baru lewat MS2 */}
      <Sheet
        open={baru}
        onOpenChange={setBaru}
        title="Permintaan baru (MS2)"
        description="Nomor SO dan LO diisi dari daftar plan setelah terbit dari depot."
        footer={
          <Button size="lg" className="flex-1" disabled={menyimpan} onClick={simpan}>
            <ClipboardList aria-hidden="true" />
            {menyimpan ? 'Menyimpan…' : 'Simpan permintaan'}
          </Button>
        }
      >
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
      </Sheet>

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
