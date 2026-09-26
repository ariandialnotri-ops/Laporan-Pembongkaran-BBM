import { useState } from 'react'
import { CalendarDays, CircleCheck, CircleDashed, ClipboardList, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { PRODUK_OPTIONS, type Plan as PlanT } from '@/lib/sop'

type LoForm = { id: string; noLO: string; jumlahDO: string }
const blankLo = (): LoForm => ({ id: genId('lo'), noLO: '', jumlahDO: '1' })
const blankForm = (tanggal = todayIso()) => ({ tanggal, noSO: '', produk: PRODUK_OPTIONS[0], soldTo: '', los: [blankLo()] })

export function Plan() {
  const app = useApp()
  const toast = useToast()
  const [form, setForm] = useState(() => blankForm())
  const [error, setError] = useState<string | null>(null)

  const allLo = new Set(app.plans.flatMap((p) => p.los.map((lo) => lo.noLO.trim().toUpperCase())))
  const setLo = (id: string, patch: Partial<LoForm>) => setForm({ ...form, los: form.los.map((lo) => (lo.id === id ? { ...lo, ...patch } : lo)) })
  const totalLo = app.plans.reduce((n, p) => n + p.los.length, 0)
  const dibongkar = app.plans.reduce((n, p) => n + p.los.filter((lo) => app.usedLoIds.has(lo.id)).length, 0)

  const simpan = async () => {
    const los = form.los.filter((lo) => lo.noLO.trim())
    if (!form.noSO.trim()) return setError('Isi nomor SO.')
    if (!los.length) return setError('Isi minimal satu nomor LO.')
    if (los.some((lo) => !((parseAngka(lo.jumlahDO) ?? 0) > 0))) return setError('Jumlah DO tiap LO harus lebih dari 0.')
    const seen = new Set<string>()
    for (const lo of los) {
      const key = lo.noLO.trim().toUpperCase()
      if (allLo.has(key) || seen.has(key)) return setError(`Nomor LO ${lo.noLO} sudah terdaftar.`)
      seen.add(key)
    }
    const plan: PlanT = {
      id: genId('plan'),
      createdAt: Date.now(),
      tanggal: form.tanggal,
      noSO: form.noSO.trim(),
      produk: form.produk,
      soldTo: form.soldTo.trim(),
      los: los.map((lo) => ({ id: lo.id, noLO: lo.noLO.trim(), jumlahDO: parseAngka(lo.jumlahDO) ?? 1 })),
    }
    setError(null)
    try {
      await app.savePlan(plan)
      setForm(blankForm(form.tanggal))
      toast(`Plan SO ${plan.noSO} tersimpan`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan plan')
    }
  }

  const hapus = async (plan: PlanT, loId?: string) => {
    const sisa = loId ? plan.los.filter((l) => l.id !== loId) : []
    if (!loId || sisa.length === 0) {
      if (!window.confirm(`Hapus plan SO ${plan.noSO}?`)) return
    }
    try {
      if (sisa.length) await app.savePlan({ ...plan, los: sisa })
      else await app.deletePlan(plan)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus', TriangleAlert)
    }
  }

  const sorted = [...app.plans].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.createdAt - a.createdAt)
  const dates = [...new Set(sorted.map((p) => p.tanggal))]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Plan pengiriman harian</span>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          {[
            ['SO', app.plans.length],
            ['LO belum datang', totalLo - dibongkar],
            ['LO dibongkar', dibongkar],
          ].map(([label, n]) => (
            <div key={label} className="flex flex-col rounded-md bg-surface-container-low/70 p-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">{label}</span>
              <span className="tabular mt-0.5 text-numeric-md font-bold text-on-surface">{n}</span>
            </div>
          ))}
        </div>
        <span className="text-body-sm text-on-surface-variant">Petugas memilih SO & LO dari daftar ini saat bongkar — nomor tidak bisa diketik manual.</span>
      </GlassCard>

      {app.canManage ? (
        <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Tanggal kirim" htmlFor="plan-tgl">
              <Input id="plan-tgl" type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </Field>
            <Field label="Produk" htmlFor="plan-produk">
              <Select value={form.produk} onValueChange={(v) => setForm({ ...form, produk: v })}>
                <SelectTrigger id="plan-produk">
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
            </Field>
            <Field label="Nomor SO" htmlFor="plan-so">
              <Input id="plan-so" autoComplete="off" value={form.noSO} onChange={(e) => setForm({ ...form, noSO: e.target.value })} />
            </Field>
            <Field label="No. Sold To" htmlFor="plan-sold">
              <Input id="plan-sold" autoComplete="off" placeholder="opsional" value={form.soldTo} onChange={(e) => setForm({ ...form, soldTo: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-col gap-space-xs">
            <span className="text-tag uppercase text-on-surface-variant">LO dalam SO ini</span>
            {form.los.map((lo, i) => (
              <div key={lo.id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-space-xs">
                <Input aria-label={`Nomor LO ${i + 1}`} placeholder={`Nomor LO ${i + 1}`} value={lo.noLO} onChange={(e) => setLo(lo.id, { noLO: e.target.value })} />
                <Input aria-label="Jumlah DO" numeric inputMode="decimal" suffix="DO" value={lo.jumlahDO} onChange={(e) => setLo(lo.id, { jumlahDO: e.target.value })} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus baris LO"
                  disabled={form.los.length === 1}
                  onClick={() => setForm({ ...form, los: form.los.filter((l) => l.id !== lo.id) })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button variant="soft" size="sm" className="self-start" onClick={() => setForm({ ...form, los: [...form.los, blankLo()] })}>
              <Plus aria-hidden="true" />
              Tambah LO
            </Button>
          </div>
          {error && (
            <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
              <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
            </div>
          )}
          <Button size="lg" className="w-full" onClick={simpan}>
            <ClipboardList aria-hidden="true" />
            Simpan plan
          </Button>
        </GlassCard>
      ) : (
        <GlassCard level={1} className="animate-entrance-2 p-space-md text-center text-body-sm text-on-surface-variant">
          Plan pengiriman diinput oleh pengawas.
        </GlassCard>
      )}

      {dates.length === 0 && (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada plan pengiriman.
        </GlassCard>
      )}
      {dates.map((tgl) => (
        <section key={tgl} aria-label={`Plan ${formatTanggalIso(tgl)}`} className="animate-entrance-3 flex flex-col gap-space-sm">
          <SectionHeader id={`plan-${tgl}`} title={formatTanggalIso(tgl)} action={<CalendarDays aria-hidden="true" className="size-5 text-on-surface-variant" />} />
          {sorted
            .filter((p) => p.tanggal === tgl)
            .map((plan) => {
              const anyUsed = plan.los.some((lo) => app.usedLoIds.has(lo.id))
              return (
                <GlassCard key={plan.id} level={1} className="flex flex-col gap-space-xs p-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-primary">
                      <ClipboardList className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="tabular text-body-md font-semibold text-on-surface">SO {plan.noSO}</span>
                      <span className="truncate text-body-sm text-on-surface-variant">
                        {plan.produk}
                        {plan.soldTo ? ` • Sold to ${plan.soldTo}` : ''}
                      </span>
                    </div>
                    {app.canManage && !anyUsed && (
                      <Button variant="ghost" size="icon" aria-label={`Hapus plan SO ${plan.noSO}`} onClick={() => hapus(plan)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {plan.los.map((lo) => {
                    const used = app.usedLoIds.get(lo.id)
                    return (
                      <div key={lo.id} className="flex min-h-11 items-center gap-space-sm rounded-md px-space-sm">
                        <span className="tabular flex-1 text-body-sm text-on-surface">
                          LO {lo.noLO} · {lo.jumlahDO} DO ({formatLiter(lo.jumlahDO * app.rules.literPerDO)})
                        </span>
                        {used ? (
                          <Pill tone="primary">
                            <CircleCheck aria-hidden="true" />
                            {used.nopol || 'Dibongkar'}
                          </Pill>
                        ) : (
                          <Pill>
                            <CircleDashed aria-hidden="true" />
                            Belum datang
                          </Pill>
                        )}
                        {app.canManage && !used && plan.los.length > 1 && (
                          <Button variant="ghost" size="icon" aria-label={`Hapus LO ${lo.noLO}`} onClick={() => hapus(plan, lo.id)}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </GlassCard>
              )
            })}
        </section>
      ))}
    </div>
  )
}
