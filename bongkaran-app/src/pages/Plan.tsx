import { useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, CalendarDays, ClipboardList, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { ErrorBox, LoEditSheet, ProdukSelect, SupplySelect, type LoTarget } from '@/components/bongkaran/lo-edit-sheet'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { LO_STATUS, loStatus, loStatusMeta, planBesokKurang, SHIFT_PERMINTAAN, type LoDisplayStatus } from '@/lib/plan'
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

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

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

export function Plan() {
  const app = useApp()
  const toast = useToast()
  const [form, setForm] = useState<PlanForm>(() => blankPlanForm())
  const [rows, setRows] = useState<Row[]>(() => [blankRow()])
  const [error, setError] = useState<string | null>(null)
  const [baru, setBaru] = useState(false)
  const [notifBisa, setNotifBisa] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'default')
  const [range, setRange] = useDateRange('7d')
  const [statusFilter, setStatusFilter] = useState<LoDisplayStatus | null>(null)

  const [editPlan, setEditPlan] = useState<{ plan: PlanT; form: PlanForm; error: string | null } | null>(null)
  const [editLo, setEditLo] = useState<LoTarget | null>(null)

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
  const besok = planBesokKurang(app.plans)

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
      los: valid.map((r) => ({ id: r.id, noLO: '', produk: r.produk, volume: parseAngka(r.volume) ?? 0, shift: r.shift || form.ms2Shift, status: 'os', segel: [] })),
    }
    setError(null)
    try {
      await app.savePlan(plan)
      setForm(blankPlanForm(form.tanggal))
      setRows([blankRow()])
      setBaru(false)
      toast('Permintaan tersimpan. Isi SO & LO di daftar saat sudah terbit.')
    } catch (e) {
      setError(pesan(e))
    }
  }

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

  const bukaLo = (plan: PlanT, lo: PlanLo | null) => setEditLo({ plan, lo })

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
                                {lo.produk} <span className="tabular font-normal text-on-surface-variant">{formatLiter(lo.volume)}{lo.shift ? `, shift ${lo.shift}` : ''}</span>
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

      {/* Permintaan baru lewat MS2 */}
      <Sheet
        open={baru}
        onOpenChange={setBaru}
        title="Permintaan baru (MS2)"
        description="Nomor SO dan LO diisi dari daftar plan setelah terbit dari depot."
        footer={
          <Button size="lg" className="flex-1" onClick={simpan}>
            <ClipboardList aria-hidden="true" />
            Simpan permintaan
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
                <Choice label={`Shift permintaan produk ${i + 1}`} value={r.shift || form.ms2Shift} onChange={(v) => setRow({ shift: v })} options={SHIFT_PERMINTAAN} />
              </div>
            )
          })}
          <Button variant="soft" size="sm" className="self-start" onClick={() => setRows([...rows, blankRow(rows.at(-1)?.shift || form.ms2Shift)])}>
            <Plus aria-hidden="true" />
            Tambah produk
          </Button>
        </div>
        <ErrorBox text={error} />
      </Sheet>

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

      <LoEditSheet target={editLo} onClose={() => setEditLo(null)} />
    </div>
  )
}
