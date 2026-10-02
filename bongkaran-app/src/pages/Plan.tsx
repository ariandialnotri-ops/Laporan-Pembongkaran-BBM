import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ClipboardList, Pencil, Plus, Repeat, Trash2, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field, TagInput } from '@/components/bongkaran/form-bits'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { LO_MANUAL_STATUS, LO_STATUS, loStatus, loStatusMeta, planSupply, type LoDisplayStatus } from '@/lib/plan'
import { PRODUK_OPTIONS, SUPPLY_POINTS, type LoStatus, type Plan as PlanT, type PlanLo } from '@/lib/sop'
import { cn } from '@/lib/utils'

type Row = { id: string; produk: string; volume: string }
const blankRow = (produk = PRODUK_OPTIONS[0]): Row => ({ id: genId('lo'), produk, volume: '8000' })

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

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
      <span className="text-body-sm font-semibold text-on-error-container">{text}</span>
    </div>
  )
}

function ProdukSelect({ id, value, onChange, label = 'Produk' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRODUK_OPTIONS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SupplySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Pilih supply point" />
      </SelectTrigger>
      <SelectContent>
        {SUPPLY_POINTS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Kolom data permintaan MS2: dipakai di form baru dan sheet edit. */
function PlanFields({ form, set, idp, withSo }: { form: PlanForm; set: (p: Partial<PlanForm>) => void; idp: string; withSo?: boolean }) {
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
      <Field label="Shift permintaan" className="col-span-2">
        <Choice
          label="Shift permintaan"
          value={form.ms2Shift}
          onChange={(v) => set({ ms2Shift: v })}
          options={[
            { value: '1', label: 'Shift 1' },
            { value: '2', label: 'Shift 2' },
          ]}
        />
      </Field>
      <Field label="No. Ship To" htmlFor={`${idp}-ship`}>
        <Input id={`${idp}-ship`} autoComplete="off" inputMode="numeric" value={form.shipTo} onChange={(e) => set({ shipTo: e.target.value })} />
      </Field>
      <Field label="No. PO SAP" htmlFor={`${idp}-po`}>
        <Input id={`${idp}-po`} autoComplete="off" placeholder="opsional" value={form.poSap} onChange={(e) => set({ poSap: e.target.value })} />
      </Field>
      {withSo && (
        <Field label="Nomor SO" htmlFor={`${idp}-so`} className="col-span-2" hint="Isi setelah SO terbit dari depot.">
          <Input id={`${idp}-so`} autoComplete="off" inputMode="numeric" value={form.noSO} onChange={(e) => set({ noSO: e.target.value })} />
        </Field>
      )}
    </div>
  )
}

function validatePlan(f: PlanForm) {
  if (!f.tanggal) return 'Isi tanggal kirim.'
  if (!f.ms2Tanggal || !f.ms2Jam) return 'Isi tanggal dan jam permintaan lewat MS2.'
  if (!f.ms2Shift) return 'Pilih shift permintaan.'
  if (!f.supplyPoint) return 'Pilih supply point.'
  if (!f.shipTo.trim()) return 'Isi nomor Ship To.'
  return null
}

type LoForm = { noLO: string; produk: string; volume: string; status: LoStatus; segel: string[]; alihLO: string; alihSP: string }

export function Plan() {
  const app = useApp()
  const toast = useToast()
  const [form, setForm] = useState<PlanForm>(() => blankPlanForm())
  const [rows, setRows] = useState<Row[]>(() => [blankRow()])
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useDateRange('7d')
  const [statusFilter, setStatusFilter] = useState<LoDisplayStatus | null>(null)

  const [editPlan, setEditPlan] = useState<{ plan: PlanT; form: PlanForm; error: string | null } | null>(null)
  const [editLo, setEditLo] = useState<{ plan: PlanT; lo: PlanLo | null; form: LoForm; error: string | null } | null>(null)

  const used = app.usedLoIds
  const inDate = useMemo(() => app.plans.filter((p) => inRange(p.tanggal, range)), [app.plans, range])
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

  const simpan = async () => {
    const err = validatePlan(form)
    if (err) return setError(err)
    const valid = rows.filter((r) => (parseAngka(r.volume) ?? 0) > 0)
    if (!valid.length) return setError('Isi minimal satu produk dengan volume lebih dari 0 liter.')
    const plan: PlanT = {
      id: genId('plan'),
      createdAt: Date.now(),
      ...form,
      shipTo: form.shipTo.trim(),
      poSap: form.poSap.trim(),
      noSO: '',
      produk: '',
      soldTo: '',
      los: valid.map((r) => ({ id: r.id, noLO: '', produk: r.produk, volume: parseAngka(r.volume) ?? 0, status: 'os', segel: [] })),
    }
    setError(null)
    try {
      await app.savePlan(plan)
      setForm(blankPlanForm(form.tanggal))
      setRows([blankRow()])
      toast('Permintaan tersimpan. Isi SO & LO di daftar saat sudah terbit.')
    } catch (e) {
      setError(pesan(e))
    }
  }

  const allLo = (exceptLoId?: string) =>
    new Set(
      app.plans
        .flatMap((p) => p.los.filter((lo) => lo.id !== exceptLoId).flatMap((lo) => [lo.noLO, lo.noLOLama ?? '']))
        .map((n) => n.trim().toUpperCase())
        .filter(Boolean),
    )

  const simpanPlanEdit = async () => {
    if (!editPlan) return
    const err = validatePlan(editPlan.form)
    if (err) return setEditPlan({ ...editPlan, error: err })
    try {
      await app.savePlan({ ...editPlan.plan, ...editPlan.form, noSO: editPlan.form.noSO.trim(), shipTo: editPlan.form.shipTo.trim(), poSap: editPlan.form.poSap.trim() })
      setEditPlan(null)
      toast('Plan diperbarui')
    } catch (e) {
      setEditPlan({ ...editPlan, error: pesan(e) })
    }
  }

  const bukaLo = (plan: PlanT, lo: PlanLo | null) =>
    setEditLo({
      plan,
      lo,
      error: null,
      form: lo
        ? { noLO: lo.noLO, produk: lo.produk, volume: String(lo.volume), status: lo.status, segel: lo.segel, alihLO: '', alihSP: planSupply(plan, lo) }
        : { noLO: '', produk: PRODUK_OPTIONS[0], volume: '8000', status: 'os', segel: [], alihLO: '', alihSP: plan.supplyPoint },
    })

  const simpanLo = async () => {
    if (!editLo) return
    const { plan, lo, form: f } = editLo
    const fail = (error: string) => setEditLo({ ...editLo, error })
    const volume = parseAngka(f.volume)
    if (!(volume && volume > 0)) return fail('Volume harus lebih dari 0 liter.')
    const taken = allLo(lo?.id)
    const alih = f.status === 'alih' && !!lo && lo.status !== 'alih'
    if (alih) {
      if (!lo.noLO.trim()) return fail('LO belum punya nomor, tidak bisa dialih supply.')
      const baru = f.alihLO.trim().toUpperCase()
      if (!baru) return fail('Isi nomor LO baru dari terminal tujuan.')
      if (taken.has(baru) || baru === lo.noLO.trim().toUpperCase()) return fail(`Nomor LO ${f.alihLO} sudah terdaftar.`)
      if (!f.alihSP || f.alihSP === planSupply(plan, lo)) return fail('Pilih supply point baru yang berbeda.')
    } else if (f.noLO.trim() && taken.has(f.noLO.trim().toUpperCase())) {
      return fail(`Nomor LO ${f.noLO} sudah terdaftar.`)
    }
    const next: PlanLo =
      alih && lo
        ? { ...lo, produk: f.produk, volume, segel: f.segel, status: 'alih', noLOLama: lo.noLO, supplyPointLama: planSupply(plan, lo), noLO: f.alihLO.trim(), supplyPoint: f.alihSP }
        : { ...(lo ?? { id: genId('lo') }), noLO: f.noLO.trim(), produk: f.produk, volume, status: f.status, segel: f.segel }
    const los = lo ? plan.los.map((x) => (x.id === lo.id ? next : x)) : [...plan.los, next]
    try {
      await app.savePlan({ ...plan, los })
      setEditLo(null)
      toast(alih ? `Alih supply: LO ${next.noLOLama} menjadi ${next.noLO}` : 'LO tersimpan')
    } catch (e) {
      fail(pesan(e))
    }
  }

  const hapusLo = async () => {
    if (!editLo?.lo) return
    const { plan, lo } = editLo
    if (!window.confirm(`Hapus baris ${lo.noLO ? `LO ${lo.noLO}` : lo.produk} dari plan ini? Untuk LO yang dibatalkan depot, pakai status Deleted.`)) return
    try {
      const sisa = plan.los.filter((x) => x.id !== lo.id)
      if (sisa.length) await app.savePlan({ ...plan, los: sisa })
      else await app.deletePlan(plan)
      setEditLo(null)
    } catch (e) {
      setEditLo({ ...editLo, error: pesan(e) })
    }
  }

  const hapusPlan = async (plan: PlanT) => {
    if (!window.confirm(`Hapus plan ${plan.noSO ? `SO ${plan.noSO}` : `tanggal ${formatTanggalIso(plan.tanggal)}`}?`)) return
    try {
      await app.deletePlan(plan)
      setEditPlan(null)
    } catch (e) {
      toast(pesan(e), TriangleAlert)
    }
  }

  const visible = inDate
    .filter((p) => !statusFilter || p.los.some((lo) => loStatus(lo, used) === statusFilter))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.createdAt - a.createdAt)
  const dates = [...new Set(visible.map((p) => p.tanggal))]

  return (
    <div className="flex flex-col gap-space-md">
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

      {/* Permintaan baru lewat MS2 */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-col">
          <h2 className="text-headline-md font-bold text-on-surface">Permintaan baru (MS2)</h2>
          <span className="text-body-sm text-on-surface-variant">Nomor SO dan LO diisi dari daftar plan setelah terbit dari depot.</span>
        </div>
        <PlanFields idp="plan" form={form} set={(p) => setForm({ ...form, ...p })} />
        <div className="flex flex-col gap-space-xs">
          <span className="text-tag uppercase text-on-surface-variant">Produk yang diminta</span>
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-space-xs">
              <ProdukSelect id={`plan-row-${i}`} label={`Produk ${i + 1}`} value={r.produk} onChange={(v) => setRows(rows.map((x) => (x.id === r.id ? { ...x, produk: v } : x)))} />
              <Input
                aria-label={`Volume produk ${i + 1}`}
                numeric
                inputMode="numeric"
                suffix="L"
                value={r.volume}
                onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, volume: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon" aria-label={`Hapus produk ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button variant="soft" size="sm" className="self-start" onClick={() => setRows([...rows, blankRow()])}>
            <Plus aria-hidden="true" />
            Tambah produk
          </Button>
        </div>
        <ErrorBox text={error} />
        <Button size="lg" className="w-full" onClick={simpan}>
          <ClipboardList aria-hidden="true" />
          Simpan permintaan
        </Button>
      </GlassCard>

      {dates.length === 0 && (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          {statusFilter ? 'Tidak ada LO dengan status ini pada rentang tanggal terpilih.' : 'Belum ada plan pengiriman pada rentang tanggal ini.'}
        </GlassCard>
      )}

      {dates.map((tgl) => (
        <section key={tgl} aria-labelledby={`plan-${tgl}`} className="animate-entrance-3 flex flex-col gap-space-sm">
          <SectionHeader id={`plan-${tgl}`} title={`Kirim ${formatTanggalIso(tgl)}`} action={<CalendarDays aria-hidden="true" className="size-5 text-on-surface-variant" />} />
          {visible
            .filter((p) => p.tanggal === tgl)
            .map((plan) => {
              const total = plan.los.filter((lo) => loStatus(lo, used) !== 'deleted').reduce((n, lo) => n + lo.volume, 0)
              const los = statusFilter ? plan.los.filter((lo) => loStatus(lo, used) === statusFilter) : plan.los
              return (
                <GlassCard key={plan.id} level={1} className="flex flex-col gap-space-xs p-space-sm">
                  <div className="flex items-start gap-space-sm">
                    <div className="flex min-w-0 flex-1 flex-col pl-space-xs pt-1">
                      <span className="tabular text-body-md font-semibold text-on-surface">{plan.noSO ? `SO ${plan.noSO}` : 'SO belum terbit'}</span>
                      <span className="text-body-sm text-on-surface-variant">{[plan.supplyPoint, plan.shipTo && `Ship to ${plan.shipTo}`].filter(Boolean).join(', ')}</span>
                      <span className="tabular text-body-sm text-on-surface-variant">
                        MS2 {formatTanggalIso(plan.ms2Tanggal)} {plan.ms2Jam}
                        {plan.ms2Shift ? `, shift ${plan.ms2Shift}` : ''}
                        {plan.poSap ? `, PO ${plan.poSap}` : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Ubah plan ${plan.noSO ? `SO ${plan.noSO}` : formatTanggalIso(plan.tanggal)}`}
                      onClick={() =>
                        setEditPlan({
                          plan,
                          error: null,
                          form: { tanggal: plan.tanggal, ms2Tanggal: plan.ms2Tanggal, ms2Jam: plan.ms2Jam, ms2Shift: plan.ms2Shift, poSap: plan.poSap, shipTo: plan.shipTo, supplyPoint: plan.supplyPoint, noSO: plan.noSO },
                        })
                      }
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {los.map((lo) => {
                      const st = loStatusMeta(loStatus(lo, used))
                      return (
                        <li key={lo.id}>
                          <button
                            type="button"
                            onClick={() => bukaLo(plan, lo)}
                            className="flex min-h-14 w-full items-center gap-space-sm rounded-md bg-surface-container-lowest/60 px-space-sm py-space-xs text-left transition-colors hover:bg-surface-container-lowest active:scale-[0.99]"
                          >
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="text-body-sm font-semibold text-on-surface">
                                {lo.produk} <span className="tabular font-normal text-on-surface-variant">{formatLiter(lo.volume)}</span>
                              </span>
                              {lo.noLOLama ? (
                                <span className="tabular flex flex-wrap items-center gap-1 text-body-sm text-on-surface-variant">
                                  <s>LO {lo.noLOLama}</s> ({lo.supplyPointLama})
                                  <ArrowRight aria-label="menjadi" className="size-3.5" />
                                  <b className="text-on-surface">LO {lo.noLO}</b> ({lo.supplyPoint})
                                </span>
                              ) : (
                                <span className="tabular text-body-sm text-on-surface-variant">{lo.noLO ? `LO ${lo.noLO}` : 'LO belum terbit'}</span>
                              )}
                              {lo.segel.length > 0 && <span className="tabular text-body-sm text-on-surface-variant">Segel {lo.segel.join(', ')}</span>}
                            </div>
                            <Pill tone={st.tone}>{st.label}</Pill>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex items-center justify-between gap-2 pl-space-xs">
                    <span className="tabular text-body-sm text-on-surface-variant">Total {formatNumber(total)} L</span>
                    <Button variant="soft" size="sm" onClick={() => bukaLo(plan, null)}>
                      <Plus aria-hidden="true" />
                      Tambah LO
                    </Button>
                  </div>
                </GlassCard>
              )
            })}
        </section>
      ))}

      {/* Edit data plan & nomor SO */}
      <Sheet
        open={!!editPlan}
        onOpenChange={(o) => !o && setEditPlan(null)}
        title={editPlan?.plan.noSO ? `SO ${editPlan.plan.noSO}` : 'Ubah plan'}
        description="Data permintaan MS2 dan nomor SO."
        footer={
          editPlan && (
            <>
              {app.canManage && !editPlan.plan.los.some((lo) => used.has(lo.id)) && (
                <Button variant="ghost" size="icon" aria-label="Hapus plan" onClick={() => hapusPlan(editPlan.plan)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
              <Button className="flex-1" onClick={simpanPlanEdit}>
                Simpan
              </Button>
            </>
          )
        }
      >
        {editPlan && (
          <>
            <PlanFields idp="edit-plan" withSo form={editPlan.form} set={(p) => setEditPlan({ ...editPlan, form: { ...editPlan.form, ...p }, error: null })} />
            <ErrorBox text={editPlan.error} />
          </>
        )}
      </Sheet>

      {/* Edit LO: nomor, produk, volume, status, segel, alih supply */}
      <Sheet
        open={!!editLo}
        onOpenChange={(o) => !o && setEditLo(null)}
        title={editLo?.lo ? (editLo.lo.noLO ? `LO ${editLo.lo.noLO}` : `${editLo.lo.produk}, LO belum terbit`) : 'Tambah LO'}
        description={editLo ? `${editLo.plan.noSO ? `SO ${editLo.plan.noSO}` : 'SO belum terbit'}, ${planSupply(editLo.plan, editLo.lo ?? undefined)}` : undefined}
        footer={
          editLo && (
            <>
              {editLo.lo && app.canManage && !used.has(editLo.lo.id) && (
                <Button variant="ghost" size="icon" aria-label="Hapus baris LO" onClick={hapusLo}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
              <Button className="flex-1" onClick={simpanLo}>
                Simpan LO
              </Button>
            </>
          )
        }
      >
        {editLo && (
          <>
            <LoEditor
              value={editLo.form}
              lo={editLo.lo}
              usedBy={editLo.lo ? used.get(editLo.lo.id) : undefined}
              currentSupply={planSupply(editLo.plan, editLo.lo ?? undefined)}
              onChange={(p) => setEditLo({ ...editLo, form: { ...editLo.form, ...p }, error: null })}
            />
            <ErrorBox text={editLo.error} />
          </>
        )}
      </Sheet>
    </div>
  )
}

function LoEditor({
  value: f,
  lo,
  usedBy,
  currentSupply,
  onChange,
}: {
  value: LoForm
  lo: PlanLo | null
  usedBy: { nopol: string; status: string } | undefined
  currentSupply: string
  onChange: (p: Partial<LoForm>) => void
}) {
  const startAlih = f.status === 'alih' && !!lo && lo.status !== 'alih'
  return (
    <>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Produk" htmlFor="lo-produk-edit">
          <ProdukSelect id="lo-produk-edit" value={f.produk} onChange={(v) => onChange({ produk: v })} />
        </Field>
        <Field label="Volume" htmlFor="lo-vol-edit">
          <Input id="lo-vol-edit" numeric inputMode="numeric" suffix="L" value={f.volume} onChange={(e) => onChange({ volume: e.target.value })} />
        </Field>
        <Field label="Nomor LO" htmlFor="lo-no-edit" className="col-span-2">
          <Input id="lo-no-edit" autoComplete="off" inputMode="numeric" disabled={startAlih} value={f.noLO} onChange={(e) => onChange({ noLO: e.target.value })} />
        </Field>
      </div>

      {usedBy ? (
        <div className="inset-field rounded-md p-space-sm text-body-sm text-on-surface">
          Status <b>{usedBy.status === 'draft' ? 'Delivered' : 'Closed'}</b> otomatis dari data bongkaran MT {usedBy.nopol || '-'}.
        </div>
      ) : (
        <Field label="Status LO">
          <div role="radiogroup" aria-label="Status LO" className="grid grid-cols-2 gap-space-xs">
            {LO_MANUAL_STATUS.map((k) => {
              const m = loStatusMeta(k)
              const on = f.status === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ status: k })}
                  className={cn(
                    'flex min-h-14 flex-col items-start justify-center rounded-md px-space-sm py-space-xs text-left transition-colors',
                    on ? 'bg-primary text-on-primary' : 'inset-field text-on-surface',
                  )}
                >
                  <span className="text-body-sm font-semibold">{m.label}</span>
                  <span className={cn('text-tag normal-case tracking-normal', on ? 'text-on-primary' : 'text-on-surface-variant')}>{m.desc}</span>
                </button>
              )
            })}
          </div>
          <span className="text-body-sm text-on-surface-variant">Delivered dan Closed terisi otomatis saat LO dipakai bongkaran.</span>
        </Field>
      )}

      {startAlih && (
        <div className="flex flex-col gap-space-sm rounded-md bg-secondary-fixed/40 p-space-sm">
          <span className="flex items-center gap-space-xs text-body-sm font-semibold text-on-surface">
            <Repeat aria-hidden="true" className="size-4" />
            Adjustment alih supply dari {currentSupply}
          </span>
          <span className="text-body-sm text-on-surface-variant">LO {lo?.noLO} tetap ditampilkan sebagai LO lama di kartu plan.</span>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Nomor LO baru" htmlFor="lo-alih-no">
              <Input id="lo-alih-no" autoComplete="off" inputMode="numeric" value={f.alihLO} onChange={(e) => onChange({ alihLO: e.target.value })} />
            </Field>
            <Field label="Supply point baru" htmlFor="lo-alih-sp">
              <SupplySelect id="lo-alih-sp" value={f.alihSP} onChange={(v) => onChange({ alihSP: v })} />
            </Field>
          </div>
        </div>
      )}

      <Field label="Nomor segel (sesuai dokumen LO)" htmlFor="lo-segel-edit" hint="Dipakai petugas untuk mencocokkan segel saat bongkar.">
        <TagInput id="lo-segel-edit" values={f.segel} onChange={(v) => onChange({ segel: v })} placeholder="Ketik nomor segel" />
      </Field>
    </>
  )
}
